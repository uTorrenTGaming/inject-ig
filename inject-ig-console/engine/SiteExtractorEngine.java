import java.io.*;
import java.net.*;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.regex.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
import com.sun.net.httpserver.*;
import java.time.*;
import java.time.format.*;

/**
 * inject-ig Site Extractor Engine v2.0
 * Motor autônomo Java para extração completa de recursos web.
 * Comunica via HTTP local na porta 7890.
 */
public class SiteExtractorEngine {

    static final int PORT = 7890;
    static final int MAX_THREADS = 12;
    static final int TIMEOUT_SECONDS = 15;

    // Telemetria
    static AtomicInteger threadsActive = new AtomicInteger(0);
    static AtomicInteger totalExtracted = new AtomicInteger(0);
    static AtomicLong heapUsed = new AtomicLong(0);
    static AtomicLong heapMax = new AtomicLong(0);
    static String lastTarget = "";
    static long startTime = System.currentTimeMillis();

    // Resultados da última varredura
    static volatile Map<String, Object> lastScanResult = new HashMap<>();

    public static void main(String[] args) throws Exception {
        System.out.println("[EXTRACTOR] Iniciando SiteExtractorEngine na porta " + PORT);
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", PORT), 50);

        server.createContext("/health",   SiteExtractorEngine::handleHealth);
        server.createContext("/scan",     SiteExtractorEngine::handleScan);
        server.createContext("/result",   SiteExtractorEngine::handleResult);
        server.createContext("/telemetry",SiteExtractorEngine::handleTelemetry);
        server.createContext("/download", SiteExtractorEngine::handleDownload);

        server.setExecutor(Executors.newFixedThreadPool(MAX_THREADS + 4));
        server.start();
        System.out.println("[EXTRACTOR] Engine online em http://127.0.0.1:" + PORT);

        // Loop de telemetria de memória
        ScheduledExecutorService sched = Executors.newSingleThreadScheduledExecutor();
        sched.scheduleAtFixedRate(() -> {
            Runtime rt = Runtime.getRuntime();
            heapUsed.set((rt.totalMemory() - rt.freeMemory()) / (1024 * 1024));
            heapMax.set(rt.maxMemory() / (1024 * 1024));
        }, 0, 2, TimeUnit.SECONDS);
    }

    // ─── /health ──────────────────────────────────────────────────
    static void handleHealth(HttpExchange ex) throws IOException {
        String resp = "{\"status\":\"online\",\"engine\":\"SiteExtractorEngine\",\"version\":\"2.0\","
                + "\"uptime\":" + (System.currentTimeMillis() - startTime) + "}";
        sendJson(ex, 200, resp);
    }

    // ─── /telemetry ───────────────────────────────────────────────
    static void handleTelemetry(HttpExchange ex) throws IOException {
        String resp = String.format(
            "{\"heapUsed\":%d,\"heapMax\":%d,\"threadsActive\":%d,\"totalExtracted\":%d,\"lastTarget\":\"%s\"}",
            heapUsed.get(), heapMax.get(), threadsActive.get(), totalExtracted.get(),
            escapeJson(lastTarget)
        );
        sendJson(ex, 200, resp);
    }

    // ─── /result ──────────────────────────────────────────────────
    static void handleResult(HttpExchange ex) throws IOException {
        try {
            String json = mapToJson(lastScanResult);
            sendJson(ex, 200, json);
        } catch (Exception e) {
            sendJson(ex, 500, "{\"error\":\"" + escapeJson(e.getMessage()) + "\"}");
        }
    }

    // ─── /download?category=js&index=0 ───────────────────────────
    @SuppressWarnings("unchecked")
    static void handleDownload(HttpExchange ex) throws IOException {
        String query = ex.getRequestURI().getQuery();
        Map<String, String> params = parseQuery(query);
        String category = params.getOrDefault("category", "");
        int index = Integer.parseInt(params.getOrDefault("index", "0"));

        try {
            List<Map<String, Object>> items = (List<Map<String, Object>>) lastScanResult.get(category);
            if (items == null || index >= items.size()) {
                sendJson(ex, 404, "{\"error\":\"Item not found\"}");
                return;
            }
            Map<String, Object> item = items.get(index);
            // Se tem URL, tenta baixar o conteúdo real
            String url = (String) item.getOrDefault("url", "");
            String content = "";
            if (!url.isEmpty()) {
                try { content = fetchContent(url); } catch (Exception ignored) {}
            }
            item.put("rawContent", content);
            item.put("downloadedAt", Instant.now().toString());
            String json = mapToJson(item);
            ex.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
            ex.getResponseHeaders().set("Content-Disposition", "attachment; filename=\"item_" + category + "_" + index + ".json\"");
            byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
            ex.sendResponseHeaders(200, bytes.length);
            ex.getResponseBody().write(bytes);
            ex.getResponseBody().close();
        } catch (Exception e) {
            sendJson(ex, 500, "{\"error\":\"" + escapeJson(e.getMessage()) + "\"}");
        }
    }

    // ─── /scan ─── POST body: {"url":"https://..."} ───────────────
    static void handleScan(HttpExchange ex) throws IOException {
        if (!ex.getRequestMethod().equalsIgnoreCase("POST")) {
            sendJson(ex, 405, "{\"error\":\"Method Not Allowed\"}");
            return;
        }
        String body = new String(ex.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
        String url = extractJsonValue(body, "url");
        if (url == null || url.isEmpty()) {
            sendJson(ex, 400, "{\"error\":\"URL inválida\"}");
            return;
        }

        // Responde imediatamente e processa em background
        sendJson(ex, 200, "{\"status\":\"scanning\",\"target\":\"" + escapeJson(url) + "\"}");

        ExecutorService pool = Executors.newFixedThreadPool(MAX_THREADS);
        pool.submit(() -> {
            try {
                lastTarget = url;
                lastScanResult = performFullScan(url, pool);
                totalExtracted.addAndGet(getTotalItems(lastScanResult));
            } catch (Exception e) {
                System.err.println("[EXTRACTOR] Erro no scan: " + e.getMessage());
                lastScanResult = new HashMap<>();
                lastScanResult.put("error", e.getMessage());
            } finally {
                pool.shutdown();
            }
        });
    }

    // ─── MOTOR PRINCIPAL ──────────────────────────────────────────
    @SuppressWarnings("unchecked")
    static Map<String, Object> performFullScan(String targetUrl, ExecutorService pool) throws Exception {
        System.out.println("[EXTRACTOR] Varrendo: " + targetUrl);
        threadsActive.incrementAndGet();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("target", targetUrl);
        result.put("timestamp", Instant.now().toString());
        result.put("status", "scanning");

        // Normaliza URL base
        URL base = new URL(normalizeUrl(targetUrl));
        String baseStr = base.getProtocol() + "://" + base.getHost();
        if (base.getPort() != -1) baseStr += ":" + base.getPort();

        // 1. Baixa HTML principal
        String html = fetchContent(targetUrl);
        if (html == null || html.isEmpty()) {
            result.put("status", "error");
            result.put("error", "Não foi possível acessar o site.");
            threadsActive.decrementAndGet();
            return result;
        }

        // Informações gerais
        Map<String, Object> meta = extractMeta(html, targetUrl, base);
        result.put("meta", meta);

        // 2. Extrai todos os tipos de recursos
        List<Map<String, Object>> jsFiles    = extractJsFiles(html, baseStr, targetUrl);
        List<Map<String, Object>> cssFiles   = extractCssFiles(html, baseStr, targetUrl);
        List<Map<String, Object>> images     = extractImages(html, baseStr, targetUrl);
        List<Map<String, Object>> links      = extractLinks(html, baseStr, targetUrl);
        List<Map<String, Object>> endpoints  = extractApiEndpoints(html, targetUrl);
        List<Map<String, Object>> forms      = extractForms(html, targetUrl);
        List<Map<String, Object>> scripts    = extractInlineScripts(html);
        List<Map<String, Object>> cookies    = extractCookieHints(html);
        List<Map<String, Object>> dbHints    = extractDatabaseHints(html);
        List<Map<String, Object>> headers    = fetchHeaders(targetUrl);
        List<Map<String, Object>> sitemap    = trySitemap(baseStr);
        List<Map<String, Object>> robots     = tryRobots(baseStr);
        List<Map<String, Object>> fonts      = extractFonts(html, baseStr);
        List<Map<String, Object>> videos     = extractVideos(html, baseStr);
        List<Map<String, Object>> iframes    = extractIframes(html, baseStr);

        result.put("js",        jsFiles);
        result.put("css",       cssFiles);
        result.put("images",    images);
        result.put("links",     links);
        result.put("endpoints", endpoints);
        result.put("forms",     forms);
        result.put("scripts",   scripts);
        result.put("cookies",   cookies);
        result.put("database",  dbHints);
        result.put("headers",   headers);
        result.put("sitemap",   sitemap);
        result.put("robots",    robots);
        result.put("fonts",     fonts);
        result.put("videos",    videos);
        result.put("iframes",   iframes);
        result.put("status",    "complete");

        // Resumo
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("jsCount",       jsFiles.size());
        summary.put("cssCount",      cssFiles.size());
        summary.put("imagesCount",   images.size());
        summary.put("linksCount",    links.size());
        summary.put("endpointsCount",endpoints.size());
        summary.put("formsCount",    forms.size());
        summary.put("scriptsCount",  scripts.size());
        summary.put("cookiesCount",  cookies.size());
        summary.put("dbCount",       dbHints.size());
        summary.put("fontsCount",    fonts.size());
        summary.put("videosCount",   videos.size());
        summary.put("iframesCount",  iframes.size());
        summary.put("totalItems",    getTotalItems(result));
        result.put("summary", summary);

        threadsActive.decrementAndGet();
        System.out.println("[EXTRACTOR] Scan completo: " + targetUrl + " | Items: " + summary.get("totalItems"));
        return result;
    }

    // ─── EXTRATORES INDIVIDUAIS ────────────────────────────────────

    static Map<String, Object> extractMeta(String html, String url, URL base) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("url", url);
        m.put("host", base.getHost());
        m.put("protocol", base.getProtocol());
        m.put("title",       findFirst(html, "<title[^>]*>([^<]+)</title>"));
        m.put("description", findMeta(html, "description"));
        m.put("keywords",    findMeta(html, "keywords"));
        m.put("generator",   findMeta(html, "generator"));
        m.put("author",      findMeta(html, "author"));
        m.put("charset",     findFirst(html, "charset=[\"']?([^\"'\\s>]+)"));
        m.put("viewport",    findMeta(html, "viewport"));
        m.put("ogTitle",     findOgMeta(html, "og:title"));
        m.put("ogImage",     findOgMeta(html, "og:image"));
        m.put("twitterCard", findMeta(html, "twitter:card"));
        m.put("htmlSize",    html.length() + " bytes");
        m.put("scannedAt",   Instant.now().toString());
        return m;
    }

    static List<Map<String, Object>> extractJsFiles(String html, String base, String target) {
        List<Map<String, Object>> list = new ArrayList<>();
        Pattern p = Pattern.compile("<script[^>]+src=[\"']([^\"']+\\.js[^\"']*)[\"']", Pattern.CASE_INSENSITIVE);
        Matcher m = p.matcher(html);
        Set<String> seen = new HashSet<>();
        while (m.find()) {
            String url = resolveUrl(m.group(1), base, target);
            if (seen.add(url)) {
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("url", url);
                item.put("filename", getFilename(url));
                item.put("type", "javascript");
                item.put("category", "js");
                list.add(item);
            }
        }
        return list;
    }

    static List<Map<String, Object>> extractCssFiles(String html, String base, String target) {
        List<Map<String, Object>> list = new ArrayList<>();
        Pattern p = Pattern.compile("<link[^>]+href=[\"']([^\"']+\\.css[^\"']*)[\"']", Pattern.CASE_INSENSITIVE);
        Matcher m = p.matcher(html);
        Set<String> seen = new HashSet<>();
        while (m.find()) {
            String url = resolveUrl(m.group(1), base, target);
            if (seen.add(url)) {
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("url", url);
                item.put("filename", getFilename(url));
                item.put("type", "stylesheet");
                item.put("category", "css");
                list.add(item);
            }
        }
        return list;
    }

    static List<Map<String, Object>> extractImages(String html, String base, String target) {
        List<Map<String, Object>> list = new ArrayList<>();
        Pattern p = Pattern.compile("<img[^>]+src=[\"']([^\"']+)[\"']", Pattern.CASE_INSENSITIVE);
        Matcher m = p.matcher(html);
        Set<String> seen = new HashSet<>();
        while (m.find()) {
            String url = resolveUrl(m.group(1), base, target);
            if (!url.startsWith("data:") && seen.add(url)) {
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("url", url);
                item.put("filename", getFilename(url));
                item.put("type", detectImageType(url));
                item.put("category", "images");
                String alt = findFirst(m.group(0), "alt=[\"']([^\"']*)[\"']");
                item.put("alt", alt != null ? alt : "");
                list.add(item);
            }
        }
        return list;
    }

    static List<Map<String, Object>> extractLinks(String html, String base, String target) {
        List<Map<String, Object>> list = new ArrayList<>();
        Pattern p = Pattern.compile("<a[^>]+href=[\"']([^\"'#][^\"']*)[\"']", Pattern.CASE_INSENSITIVE);
        Matcher m = p.matcher(html);
        Set<String> seen = new HashSet<>();
        while (m.find() && list.size() < 200) {
            String url = resolveUrl(m.group(1), base, target);
            if (seen.add(url)) {
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("url", url);
                item.put("isExternal", !url.contains(base.replace("https://","").replace("http:/","")));
                item.put("category", "links");
                String text = findFirst(m.group(0), ">([^<]{1,80})<");
                item.put("text", text != null ? text.trim() : "");
                list.add(item);
            }
        }
        return list;
    }

    static List<Map<String, Object>> extractApiEndpoints(String html, String target) {
        List<Map<String, Object>> list = new ArrayList<>();
        Set<String> seen = new HashSet<>();

        // Padrões comuns de endpoints
        String[] patterns = {
            "fetch\\([\"'`]([^\"'`]+)[\"'`]",
            "axios\\.(get|post|put|delete|patch)\\([\"'`]([^\"'`]+)[\"'`]",
            "\\.get\\([\"'`](/[^\"'`]+)[\"'`]",
            "\\.post\\([\"'`](/[^\"'`]+)[\"'`]",
            "url:\\s*[\"'`]([^\"'`]+)[\"'`]",
            "endpoint:\\s*[\"'`]([^\"'`]+)[\"'`]",
            "baseURL:\\s*[\"'`]([^\"'`]+)[\"'`]",
            "API_URL[^=]*=\\s*[\"'`]([^\"'`]+)[\"'`]",
            "\"/api/[^\"]+\"",
            "'/api/[^']+'"
        };
        for (String pat : patterns) {
            try {
                Pattern p = Pattern.compile(pat, Pattern.CASE_INSENSITIVE);
                Matcher m = p.matcher(html);
                while (m.find() && list.size() < 100) {
                    String ep = m.groupCount() >= 2 ? m.group(m.groupCount()) : m.group(1);
                    if (ep != null && !ep.isEmpty() && seen.add(ep)) {
                        Map<String, Object> item = new LinkedHashMap<>();
                        item.put("endpoint", ep);
                        item.put("pattern", pat.substring(0, Math.min(30, pat.length())));
                        item.put("category", "endpoints");
                        list.add(item);
                    }
                }
            } catch (Exception ignored) {}
        }
        return list;
    }

    static List<Map<String, Object>> extractForms(String html, String target) {
        List<Map<String, Object>> list = new ArrayList<>();
        Pattern formP = Pattern.compile("<form([^>]*)>(.*?)</form>", Pattern.CASE_INSENSITIVE | Pattern.DOTALL);
        Matcher formM = formP.matcher(html);
        int i = 0;
        while (formM.find() && i < 50) {
            Map<String, Object> item = new LinkedHashMap<>();
            String attrs = formM.group(1);
            String body  = formM.group(2);
            item.put("action",  findAttr(attrs, "action"));
            item.put("method",  findAttr(attrs, "method"));
            item.put("id",      findAttr(attrs, "id"));
            item.put("category","forms");

            // Extrai campos do form
            List<String> fields = new ArrayList<>();
            Pattern inputP = Pattern.compile("<input[^>]+name=[\"']([^\"']+)[\"']", Pattern.CASE_INSENSITIVE);
            Matcher inputM = inputP.matcher(body);
            while (inputM.find()) fields.add(inputM.group(1));
            item.put("fields", fields);
            item.put("fieldCount", fields.size());
            list.add(item);
            i++;
        }
        return list;
    }

    static List<Map<String, Object>> extractInlineScripts(String html) {
        List<Map<String, Object>> list = new ArrayList<>();
        Pattern p = Pattern.compile("<script(?![^>]+src)[^>]*>(.*?)</script>", Pattern.CASE_INSENSITIVE | Pattern.DOTALL);
        Matcher m = p.matcher(html);
        int i = 0;
        while (m.find() && i < 30) {
            String content = m.group(1).trim();
            if (content.length() > 20) {
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("index", i);
                item.put("length", content.length());
                item.put("preview", content.substring(0, Math.min(200, content.length())));
                item.put("hasEval",    content.contains("eval("));
                item.put("hasFetch",   content.contains("fetch("));
                item.put("hasXHR",     content.contains("XMLHttpRequest"));
                item.put("hasWebSocket",content.contains("WebSocket"));
                item.put("category",   "scripts");
                list.add(item);
                i++;
            }
        }
        return list;
    }

    static List<Map<String, Object>> extractCookieHints(String html) {
        List<Map<String, Object>> list = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        String[] patterns = {
            "document\\.cookie\\s*=\\s*[\"']([^\"']+)[\"']",
            "setCookie\\([\"']([^\"']+)[\"']",
            "cookie[Nn]ame[\"']?:\\s*[\"']([^\"']+)[\"']"
        };
        for (String pat : patterns) {
            try {
                Pattern p = Pattern.compile(pat);
                Matcher m = p.matcher(html);
                while (m.find()) {
                    String cookie = m.group(1);
                    if (seen.add(cookie)) {
                        Map<String, Object> item = new LinkedHashMap<>();
                        item.put("name", cookie);
                        item.put("source", "javascript");
                        item.put("category", "cookies");
                        list.add(item);
                    }
                }
            } catch (Exception ignored) {}
        }
        return list;
    }

    static List<Map<String, Object>> extractDatabaseHints(String html) {
        List<Map<String, Object>> list = new ArrayList<>();
        String[] keywords = {
            "supabase", "firebase", "mongodb", "mysql", "postgres", "sqlite",
            "dynamodb", "redis", "elasticsearch", "prisma", "drizzle",
            "database", "db_host", "db_name", "connection_string",
            "DATABASE_URL", "MONGO_URI", "PG_HOST"
        };
        Map<String, Integer> found = new LinkedHashMap<>();
        String lower = html.toLowerCase();
        for (String kw : keywords) {
            int count = countOccurrences(lower, kw.toLowerCase());
            if (count > 0) found.put(kw, count);
        }
        for (Map.Entry<String, Integer> e : found.entrySet()) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("keyword",    e.getKey());
            item.put("occurrences",e.getValue());
            item.put("category",   "database");
            list.add(item);
        }
        return list;
    }

    static List<Map<String, Object>> fetchHeaders(String url) {
        List<Map<String, Object>> list = new ArrayList<>();
        try {
            HttpClient client = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(TIMEOUT_SECONDS))
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
            HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(normalizeUrl(url)))
                .method("HEAD", HttpRequest.BodyPublishers.noBody())
                .timeout(Duration.ofSeconds(TIMEOUT_SECONDS))
                .header("User-Agent", "Mozilla/5.0 inject-ig/2.0")
                .build();
            HttpResponse<Void> resp = client.send(req, HttpResponse.BodyHandlers.discarding());
            resp.headers().map().forEach((k, v) -> {
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("name",    k);
                item.put("value",   String.join(", ", v));
                item.put("category","headers");
                list.add(item);
            });
            Map<String, Object> statusItem = new LinkedHashMap<>();
            statusItem.put("name",    "HTTP-Status");
            statusItem.put("value",   String.valueOf(resp.statusCode()));
            statusItem.put("category","headers");
            list.add(0, statusItem);
        } catch (Exception e) {
            Map<String, Object> err = new LinkedHashMap<>();
            err.put("name",  "error");
            err.put("value", e.getMessage());
            err.put("category","headers");
            list.add(err);
        }
        return list;
    }

    static List<Map<String, Object>> trySitemap(String base) {
        List<Map<String, Object>> list = new ArrayList<>();
        String[] paths = {"/sitemap.xml", "/sitemap_index.xml", "/sitemap.txt", "/sitemap/sitemap.xml"};
        for (String p : paths) {
            try {
                String content = fetchContent(base + p);
                if (content != null && !content.isEmpty() && content.contains("<url>")) {
                    Pattern pat = Pattern.compile("<loc>([^<]+)</loc>");
                    Matcher m = pat.matcher(content);
                    while (m.find()) {
                        Map<String, Object> item = new LinkedHashMap<>();
                        item.put("url",      m.group(1));
                        item.put("source",   p);
                        item.put("category", "sitemap");
                        list.add(item);
                    }
                    break;
                }
            } catch (Exception ignored) {}
        }
        return list;
    }

    static List<Map<String, Object>> tryRobots(String base) {
        List<Map<String, Object>> list = new ArrayList<>();
        try {
            String content = fetchContent(base + "/robots.txt");
            if (content != null && !content.isEmpty()) {
                String[] lines = content.split("\n");
                for (String line : lines) {
                    if (!line.trim().isEmpty() && !line.startsWith("#")) {
                        Map<String, Object> item = new LinkedHashMap<>();
                        String[] parts = line.split(":", 2);
                        item.put("directive", parts[0].trim());
                        item.put("value",     parts.length > 1 ? parts[1].trim() : "");
                        item.put("category",  "robots");
                        list.add(item);
                    }
                }
            }
        } catch (Exception ignored) {}
        return list;
    }

    static List<Map<String, Object>> extractFonts(String html, String base) {
        List<Map<String, Object>> list = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        Pattern p = Pattern.compile("url\\([\"']?([^\"')]+\\.(woff2?|ttf|otf|eot))[^)]*[\"']?\\)", Pattern.CASE_INSENSITIVE);
        Matcher m = p.matcher(html);
        while (m.find()) {
            String url = m.group(1);
            if (seen.add(url)) {
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("url",      url);
                item.put("format",   m.group(2));
                item.put("filename", getFilename(url));
                item.put("category", "fonts");
                list.add(item);
            }
        }
        // Google Fonts
        Pattern gf = Pattern.compile("fonts\\.googleapis\\.com/css[^\"'\\s]+", Pattern.CASE_INSENSITIVE);
        Matcher gm = gf.matcher(html);
        while (gm.find() && seen.add(gm.group())) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("url",      "https://" + gm.group());
            item.put("format",   "google-fonts");
            item.put("filename", gm.group());
            item.put("category", "fonts");
            list.add(item);
        }
        return list;
    }

    static List<Map<String, Object>> extractVideos(String html, String base) {
        List<Map<String, Object>> list = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        // <video src> e <source src>
        Pattern p = Pattern.compile("<(?:video|source)[^>]+src=[\"']([^\"']+)[\"']", Pattern.CASE_INSENSITIVE);
        Matcher m = p.matcher(html);
        while (m.find()) {
            String url = m.group(1);
            if (seen.add(url)) {
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("url",      url);
                item.put("filename", getFilename(url));
                item.put("category", "videos");
                list.add(item);
            }
        }
        // YouTube iframes
        Pattern yt = Pattern.compile("youtube\\.com/embed/([a-zA-Z0-9_-]+)");
        Matcher ym = yt.matcher(html);
        while (ym.find() && seen.add(ym.group())) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("url",      "https://www.youtube.com/watch?v=" + ym.group(1));
            item.put("videoId",  ym.group(1));
            item.put("platform", "youtube");
            item.put("category", "videos");
            list.add(item);
        }
        return list;
    }

    static List<Map<String, Object>> extractIframes(String html, String base) {
        List<Map<String, Object>> list = new ArrayList<>();
        Pattern p = Pattern.compile("<iframe[^>]+src=[\"']([^\"']+)[\"']", Pattern.CASE_INSENSITIVE);
        Matcher m = p.matcher(html);
        Set<String> seen = new HashSet<>();
        while (m.find()) {
            String url = m.group(1);
            if (seen.add(url)) {
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("url",      url);
                item.put("category", "iframes");
                list.add(item);
            }
        }
        return list;
    }

    // ─── HELPERS ──────────────────────────────────────────────────

    static String fetchContent(String url) throws Exception {
        HttpClient client = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(TIMEOUT_SECONDS))
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build();
        HttpRequest req = HttpRequest.newBuilder()
            .uri(URI.create(normalizeUrl(url)))
            .timeout(Duration.ofSeconds(TIMEOUT_SECONDS))
            .header("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 inject-ig/2.0")
            .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
            .header("Accept-Language", "pt-BR,pt;q=0.9,en;q=0.8")
            .GET()
            .build();
        HttpResponse<String> resp = client.send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        return resp.body();
    }

    static String normalizeUrl(String url) {
        if (!url.startsWith("http://") && !url.startsWith("https://")) return "https://" + url;
        return url;
    }

    static String resolveUrl(String url, String base, String pageUrl) {
        if (url.startsWith("http://") || url.startsWith("https://")) return url;
        if (url.startsWith("//")) return "https:" + url;
        if (url.startsWith("/")) return base + url;
        // Relativo
        try {
            URL page = new URL(pageUrl);
            return new URL(page, url).toString();
        } catch (Exception e) {
            return base + "/" + url;
        }
    }

    static String getFilename(String url) {
        try {
            String path = new URL(url).getPath();
            int last = path.lastIndexOf('/');
            return last >= 0 ? path.substring(last + 1) : path;
        } catch (Exception e) {
            return url;
        }
    }

    static String detectImageType(String url) {
        String lower = url.toLowerCase();
        if (lower.contains(".png"))  return "png";
        if (lower.contains(".jpg") || lower.contains(".jpeg")) return "jpeg";
        if (lower.contains(".gif"))  return "gif";
        if (lower.contains(".webp")) return "webp";
        if (lower.contains(".svg"))  return "svg";
        if (lower.contains(".ico"))  return "ico";
        return "unknown";
    }

    static String findFirst(String html, String regex) {
        try {
            Pattern p = Pattern.compile(regex, Pattern.CASE_INSENSITIVE | Pattern.DOTALL);
            Matcher m = p.matcher(html);
            if (m.find()) return m.groupCount() > 0 ? m.group(1) : m.group(0);
        } catch (Exception ignored) {}
        return null;
    }

    static String findMeta(String html, String name) {
        String res = findFirst(html, "<meta[^>]+name=[\"']" + name + "[\"'][^>]+content=[\"']([^\"']+)[\"']");
        if (res == null)
            res = findFirst(html, "<meta[^>]+content=[\"']([^\"']+)[\"'][^>]+name=[\"']" + name + "[\"']");
        return res;
    }

    static String findOgMeta(String html, String prop) {
        String res = findFirst(html, "<meta[^>]+property=[\"']" + prop + "[\"'][^>]+content=[\"']([^\"']+)[\"']");
        if (res == null)
            res = findFirst(html, "<meta[^>]+content=[\"']([^\"']+)[\"'][^>]+property=[\"']" + prop + "[\"']");
        return res;
    }

    static String findAttr(String attrs, String name) {
        String res = findFirst(attrs, name + "=[\"']([^\"']*)[\"']");
        return res != null ? res : "";
    }

    static String extractJsonValue(String json, String key) {
        String res = findFirst(json, "\"" + key + "\"\\s*:\\s*\"([^\"]+)\"");
        return res;
    }

    static int countOccurrences(String text, String sub) {
        int count = 0, idx = 0;
        while ((idx = text.indexOf(sub, idx)) != -1) { count++; idx += sub.length(); }
        return count;
    }

    static Map<String, String> parseQuery(String query) {
        Map<String, String> map = new HashMap<>();
        if (query == null) return map;
        for (String part : query.split("&")) {
            String[] kv = part.split("=", 2);
            if (kv.length == 2) map.put(URLDecoder.decode(kv[0], StandardCharsets.UTF_8),
                                        URLDecoder.decode(kv[1], StandardCharsets.UTF_8));
        }
        return map;
    }

    @SuppressWarnings("unchecked")
    static int getTotalItems(Map<String, Object> result) {
        int total = 0;
        for (Object v : result.values()) {
            if (v instanceof List) total += ((List<?>) v).size();
        }
        return total;
    }

    static String escapeJson(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "\\r");
    }

    static String mapToJson(Map<String, Object> map) {
        StringBuilder sb = new StringBuilder("{");
        boolean first = true;
        for (Map.Entry<String, Object> e : map.entrySet()) {
            if (!first) sb.append(",");
            first = false;
            sb.append("\"").append(escapeJson(e.getKey())).append("\":");
            sb.append(valueToJson(e.getValue()));
        }
        sb.append("}");
        return sb.toString();
    }

    @SuppressWarnings("unchecked")
    static String valueToJson(Object v) {
        if (v == null) return "null";
        if (v instanceof String) return "\"" + escapeJson((String) v) + "\"";
        if (v instanceof Integer || v instanceof Long) return v.toString();
        if (v instanceof Boolean) return v.toString();
        if (v instanceof List) {
            List<?> list = (List<?>) v;
            StringBuilder sb = new StringBuilder("[");
            boolean first = true;
            for (Object item : list) {
                if (!first) sb.append(",");
                first = false;
                sb.append(valueToJson(item));
            }
            sb.append("]");
            return sb.toString();
        }
        if (v instanceof Map) return mapToJson((Map<String, Object>) v);
        return "\"" + escapeJson(v.toString()) + "\"";
    }

    static void sendJson(HttpExchange ex, int code, String json) throws IOException {
        ex.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
        ex.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
        byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
        ex.sendResponseHeaders(code, bytes.length);
        OutputStream os = ex.getResponseBody();
        os.write(bytes);
        os.close();
    }
}
