package com.nexus.core_engine.service;

import org.jsoup.Connection;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.springframework.stereotype.Service;

import javax.net.ssl.HttpsURLConnection;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.*;
import java.security.cert.Certificate;
import java.security.cert.X509Certificate;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import java.util.function.BiConsumer;

@Service
public class DeepReconService {

    /**
     * Executa TODAS as 20+ funções de reconhecimento profundo num alvo online.
     */
    public Map<String, Object> deepRecon(String url) {
        return deepReconStreamed(url, null);
    }

    /**
     * Versão streaming: executa cada módulo e chama o callback após cada um.
     */
    public Map<String, Object> deepReconStreamed(String url, BiConsumer<String, Object> onModuleComplete) {
        Map<String, Object> recon = new LinkedHashMap<>();

        try {
            String baseUrl = url.endsWith("/") ? url.substring(0, url.length() - 1) : url;

            Connection.Response res = Jsoup.connect(url)
                    .userAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36")
                    .timeout(12000)
                    .followRedirects(true)
                    .execute();

            Document doc = res.parse();
            String html = doc.html();
            Map<String, String> headers = res.headers();

            // 1. Security Headers Audit
            Object r1 = auditSecurityHeaders(headers);
            recon.put("security_headers", r1);
            if (onModuleComplete != null) onModuleComplete.accept("security_headers", r1);

            // 2. Cookie Analysis
            Object r2 = analyzeCookies(res.cookies(), headers);
            recon.put("cookies", r2);
            if (onModuleComplete != null) onModuleComplete.accept("cookies", r2);

            // 3. Technology Stack Detection
            Object r3 = detectTechStack(html, headers);
            recon.put("tech_stack", r3);
            if (onModuleComplete != null) onModuleComplete.accept("tech_stack", r3);

            // 4. CMS Detection
            Object r4 = detectCMS(html, baseUrl);
            recon.put("cms", r4);
            if (onModuleComplete != null) onModuleComplete.accept("cms", r4);

            // 5. CDN / WAF Detection
            Object r5 = detectCDNandWAF(headers);
            recon.put("cdn_waf", r5);
            if (onModuleComplete != null) onModuleComplete.accept("cdn_waf", r5);

            // 6. SSL/TLS Certificate Analysis
            Object r6 = analyzeSSL(baseUrl);
            recon.put("ssl_cert", r6);
            if (onModuleComplete != null) onModuleComplete.accept("ssl_cert", r6);

            // 7. Robots.txt Parser
            Object r7 = parseRobotsTxt(baseUrl);
            recon.put("robots_txt", r7);
            if (onModuleComplete != null) onModuleComplete.accept("robots_txt", r7);

            // 8. Sitemap.xml Parser
            Object r8 = parseSitemap(baseUrl);
            recon.put("sitemap", r8);
            if (onModuleComplete != null) onModuleComplete.accept("sitemap", r8);

            // 9. CORS Policy Check
            Object r9 = checkCORS(baseUrl);
            recon.put("cors", r9);
            if (onModuleComplete != null) onModuleComplete.accept("cors", r9);

            // 10. HTTP Methods Allowed
            Object r10 = checkHTTPMethods(baseUrl);
            recon.put("http_methods", r10);
            if (onModuleComplete != null) onModuleComplete.accept("http_methods", r10);

            // 11. HTML Comments Extraction (Dev Notes)
            Object r11 = extractComments(html);
            recon.put("html_comments", r11);
            if (onModuleComplete != null) onModuleComplete.accept("html_comments", r11);

            // 12. Hidden Input Fields
            Object r12 = extractHiddenInputs(doc);
            recon.put("hidden_inputs", r12);
            if (onModuleComplete != null) onModuleComplete.accept("hidden_inputs", r12);

            // 13. External Services (Analytics, Pixels)
            Object r13 = detectExternalServices(html);
            recon.put("external_services", r13);
            if (onModuleComplete != null) onModuleComplete.accept("external_services", r13);

            // 14. Social Media Links
            Object r14 = extractSocialLinks(doc);
            recon.put("social_links", r14);
            if (onModuleComplete != null) onModuleComplete.accept("social_links", r14);

            // 15. Phone Numbers
            Object r15 = extractPhoneNumbers(html);
            recon.put("phone_numbers", r15);
            if (onModuleComplete != null) onModuleComplete.accept("phone_numbers", r15);

            // 16. Asset Inventory (Images, CSS, Fonts)
            Object r16 = inventoryAssets(doc);
            recon.put("assets", r16);
            if (onModuleComplete != null) onModuleComplete.accept("assets", r16);

            // 17. API Endpoint Discovery
            Object r17 = discoverAPIs(baseUrl);
            recon.put("api_endpoints", r17);
            if (onModuleComplete != null) onModuleComplete.accept("api_endpoints", r17);

            // 18. Subdomain Enumeration
            Object r18 = enumerateSubdomains(baseUrl);
            recon.put("subdomains", r18);
            if (onModuleComplete != null) onModuleComplete.accept("subdomains", r18);

            // 19. Redirect Chain
            Object r19 = traceRedirects(url);
            recon.put("redirect_chain", r19);
            if (onModuleComplete != null) onModuleComplete.accept("redirect_chain", r19);

            // 20. Meta & Open Graph Data
            Object r20 = extractOpenGraph(doc);
            recon.put("open_graph", r20);
            if (onModuleComplete != null) onModuleComplete.accept("open_graph", r20);

            // 21. Inline Script Analysis
            Object r21 = analyzeInlineScripts(doc);
            recon.put("inline_scripts", r21);
            if (onModuleComplete != null) onModuleComplete.accept("inline_scripts", r21);

            // 22. DNS Info (basic)
            Object r22 = resolveDNS(baseUrl);
            recon.put("dns", r22);
            if (onModuleComplete != null) onModuleComplete.accept("dns", r22);

        } catch (Exception e) {
            recon.put("error", e.getMessage());
        }

        return recon;
    }

    // ── 1. Security Headers ──
    private Map<String, Object> auditSecurityHeaders(Map<String, String> headers) {
        Map<String, Object> audit = new LinkedHashMap<>();
        String[] critical = {"Content-Security-Policy", "Strict-Transport-Security", "X-Content-Type-Options",
                "X-Frame-Options", "X-XSS-Protection", "Referrer-Policy", "Permissions-Policy"};
        for (String h : critical) {
            String val = findHeader(headers, h);
            audit.put(h, val != null ? val : "AUSENTE");
        }
        return audit;
    }

    // ── 2. Cookie Analysis ──
    private Map<String, Object> analyzeCookies(Map<String, String> cookies, Map<String, String> headers) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("count", cookies.size());
        result.put("names", new ArrayList<>(cookies.keySet()));
        String setCookie = findHeader(headers, "Set-Cookie");
        if (setCookie != null) {
            result.put("httponly", setCookie.toLowerCase().contains("httponly"));
            result.put("secure", setCookie.toLowerCase().contains("secure"));
            result.put("samesite", setCookie.toLowerCase().contains("samesite"));
        }
        return result;
    }

    // ── 3. Tech Stack ──
    private List<String> detectTechStack(String html, Map<String, String> headers) {
        List<String> stack = new ArrayList<>();
        if (html.contains("__NEXT_DATA__") || html.contains("/_next/")) stack.add("Next.js");
        if (html.contains("__NUXT__") || html.contains("/_nuxt/")) stack.add("Nuxt.js");
        if (html.contains("ng-version") || html.contains("ng-app")) stack.add("Angular");
        if (html.contains("data-reactroot") || html.contains("__REACT")) stack.add("React");
        if (html.contains("data-v-") || html.contains("Vue.js")) stack.add("Vue.js");
        if (html.contains("svelte")) stack.add("Svelte");
        if (html.contains("wp-content") || html.contains("wp-includes")) stack.add("WordPress");
        if (html.contains("jquery") || html.contains("jQuery")) stack.add("jQuery");
        if (html.contains("bootstrap")) stack.add("Bootstrap");
        if (html.contains("tailwind")) stack.add("TailwindCSS");
        String xPowered = findHeader(headers, "X-Powered-By");
        if (xPowered != null) stack.add("Backend: " + xPowered);
        if (stack.isEmpty()) stack.add("Não identificado");
        return stack;
    }

    // ── 4. CMS ──
    private String detectCMS(String html, String baseUrl) {
        if (html.contains("wp-content")) return "WordPress";
        if (html.contains("Joomla")) return "Joomla";
        if (html.contains("Drupal")) return "Drupal";
        if (html.contains("Shopify")) return "Shopify";
        if (html.contains("Wix")) return "Wix";
        if (html.contains("Squarespace")) return "Squarespace";
        if (html.contains("ghost")) return "Ghost";
        return "Nenhum detectado";
    }

    // ── 5. CDN & WAF ──
    private Map<String, String> detectCDNandWAF(Map<String, String> headers) {
        Map<String, String> result = new LinkedHashMap<>();
        String server = findHeader(headers, "Server");
        if (server != null && server.toLowerCase().contains("cloudflare")) result.put("cdn", "Cloudflare");
        else if (findHeader(headers, "X-Amz-Cf-Id") != null) result.put("cdn", "AWS CloudFront");
        else if (findHeader(headers, "X-Fastly-Request-ID") != null) result.put("cdn", "Fastly");
        else if (server != null && server.toLowerCase().contains("vercel")) result.put("cdn", "Vercel Edge");
        else result.put("cdn", "Nenhum detectado");

        if (findHeader(headers, "X-Sucuri-ID") != null) result.put("waf", "Sucuri");
        else if (server != null && server.toLowerCase().contains("cloudflare")) result.put("waf", "Cloudflare WAF");
        else result.put("waf", "Nenhum detectado");
        return result;
    }

    // ── 6. SSL Certificate ──
    private Map<String, Object> analyzeSSL(String baseUrl) {
        Map<String, Object> ssl = new LinkedHashMap<>();
        try {
            URL u = new URL(baseUrl.replace("http://", "https://"));
            HttpsURLConnection conn = (HttpsURLConnection) u.openConnection();
            conn.setConnectTimeout(5000);
            conn.connect();
            Certificate[] certs = conn.getServerCertificates();
            if (certs.length > 0 && certs[0] instanceof X509Certificate) {
                X509Certificate x509 = (X509Certificate) certs[0];
                ssl.put("issuer", x509.getIssuerDN().getName());
                ssl.put("valid_from", x509.getNotBefore().toString());
                ssl.put("valid_until", x509.getNotAfter().toString());
                ssl.put("subject", x509.getSubjectDN().getName());
            }
            conn.disconnect();
        } catch (Exception e) {
            ssl.put("error", "Não foi possível analisar SSL");
        }
        return ssl;
    }

    // ── 7. Robots.txt ──
    private Map<String, Object> parseRobotsTxt(String baseUrl) {
        Map<String, Object> result = new LinkedHashMap<>();
        try {
            String content = fetchText(baseUrl + "/robots.txt");
            if (content != null && !content.contains("<html")) {
                List<String> disallowed = new ArrayList<>();
                for (String line : content.split("\n")) {
                    if (line.trim().toLowerCase().startsWith("disallow:")) {
                        disallowed.add(line.trim().substring(9).trim());
                    }
                }
                result.put("exists", true);
                result.put("disallowed_paths", disallowed);
            } else {
                result.put("exists", false);
            }
        } catch (Exception e) {
            result.put("exists", false);
        }
        return result;
    }

    // ── 8. Sitemap.xml ──
    private Map<String, Object> parseSitemap(String baseUrl) {
        Map<String, Object> result = new LinkedHashMap<>();
        try {
            String content = fetchText(baseUrl + "/sitemap.xml");
            if (content != null && content.contains("<urlset")) {
                List<String> urls = new ArrayList<>();
                Matcher m = Pattern.compile("<loc>(.*?)</loc>").matcher(content);
                while (m.find() && urls.size() < 50) urls.add(m.group(1));
                result.put("exists", true);
                result.put("url_count", urls.size());
                result.put("urls", urls);
            } else {
                result.put("exists", false);
            }
        } catch (Exception e) {
            result.put("exists", false);
        }
        return result;
    }

    // ── 9. CORS Check ──
    private Map<String, Object> checkCORS(String baseUrl) {
        Map<String, Object> result = new LinkedHashMap<>();
        try {
            HttpURLConnection conn = (HttpURLConnection) new URL(baseUrl).openConnection();
            conn.setRequestProperty("Origin", "https://evil.com");
            conn.setConnectTimeout(5000);
            String acao = conn.getHeaderField("Access-Control-Allow-Origin");
            result.put("allow_origin", acao != null ? acao : "Não definido");
            result.put("open_cors", "*".equals(acao) || "https://evil.com".equals(acao));
            conn.disconnect();
        } catch (Exception e) {
            result.put("error", e.getMessage());
        }
        return result;
    }

    // ── 10. HTTP Methods ──
    private List<String> checkHTTPMethods(String baseUrl) {
        List<String> allowed = new ArrayList<>();
        String[] methods = {"GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"};
        for (String method : methods) {
            try {
                HttpURLConnection conn = (HttpURLConnection) new URL(baseUrl).openConnection();
                conn.setRequestMethod(method);
                conn.setConnectTimeout(3000);
                int code = conn.getResponseCode();
                if (code < 405) allowed.add(method + " (" + code + ")");
                conn.disconnect();
            } catch (Exception ignored) {}
        }
        return allowed;
    }

    // ── 11. HTML Comments ──
    private List<String> extractComments(String html) {
        List<String> comments = new ArrayList<>();
        Matcher m = Pattern.compile("<!--(.*?)-->", Pattern.DOTALL).matcher(html);
        while (m.find() && comments.size() < 20) {
            String c = m.group(1).trim();
            if (c.length() > 3 && c.length() < 500) comments.add(c);
        }
        return comments;
    }

    // ── 12. Hidden Inputs ──
    private List<Map<String, String>> extractHiddenInputs(Document doc) {
        List<Map<String, String>> inputs = new ArrayList<>();
        for (Element el : doc.select("input[type=hidden]")) {
            Map<String, String> inp = new LinkedHashMap<>();
            inp.put("name", el.attr("name"));
            inp.put("value", el.attr("value").length() > 100 ? el.attr("value").substring(0, 100) + "..." : el.attr("value"));
            inputs.add(inp);
        }
        return inputs;
    }

    // ── 13. External Services ──
    private List<String> detectExternalServices(String html) {
        List<String> services = new ArrayList<>();
        if (html.contains("google-analytics.com") || html.contains("gtag")) services.add("Google Analytics");
        if (html.contains("googletagmanager.com")) services.add("Google Tag Manager");
        if (html.contains("facebook.net/en_US/fbevents")) services.add("Facebook Pixel");
        if (html.contains("hotjar.com")) services.add("Hotjar");
        if (html.contains("clarity.ms")) services.add("Microsoft Clarity");
        if (html.contains("sentry.io") || html.contains("sentry")) services.add("Sentry");
        if (html.contains("intercom")) services.add("Intercom");
        if (html.contains("crisp.chat")) services.add("Crisp Chat");
        if (html.contains("stripe.com") || html.contains("stripe.js")) services.add("Stripe");
        if (html.contains("recaptcha")) services.add("reCAPTCHA");
        if (html.contains("hcaptcha")) services.add("hCaptcha");
        if (html.contains("cloudflare")) services.add("Cloudflare");
        if (html.contains("mixpanel")) services.add("Mixpanel");
        if (html.contains("segment.com") || html.contains("analytics.js")) services.add("Segment");
        return services;
    }

    // ── 14. Social Links ──
    private List<String> extractSocialLinks(Document doc) {
        List<String> socials = new ArrayList<>();
        String[] patterns = {"facebook.com", "twitter.com", "x.com", "instagram.com", "linkedin.com",
                "youtube.com", "tiktok.com", "github.com", "discord.gg", "t.me"};
        for (Element a : doc.select("a[href]")) {
            String href = a.attr("abs:href").toLowerCase();
            for (String p : patterns) {
                if (href.contains(p) && !socials.contains(href)) {
                    socials.add(href);
                    break;
                }
            }
        }
        return socials;
    }

    // ── 15. Phone Numbers ──
    private List<String> extractPhoneNumbers(String html) {
        List<String> phones = new ArrayList<>();
        Matcher m = Pattern.compile("(?:\\+?\\d{1,3}[-.\\s]?)?\\(?\\d{2,3}\\)?[-.\\s]?\\d{4,5}[-.\\s]?\\d{4}").matcher(html);
        while (m.find() && phones.size() < 10) {
            String phone = m.group().trim();
            if (phone.length() >= 10 && !phones.contains(phone)) phones.add(phone);
        }
        return phones;
    }

    // ── 16. Asset Inventory ──
    private Map<String, Object> inventoryAssets(Document doc) {
        Map<String, Object> assets = new LinkedHashMap<>();
        assets.put("images", doc.select("img").size());
        assets.put("stylesheets", doc.select("link[rel=stylesheet]").size());
        assets.put("scripts", doc.select("script[src]").size());
        assets.put("inline_scripts", doc.select("script:not([src])").size());
        assets.put("fonts", doc.select("link[rel=preload][as=font], link[href*=fonts]").size());
        assets.put("iframes", doc.select("iframe").size());
        assets.put("videos", doc.select("video").size());
        return assets;
    }

    // ── 17. API Endpoint Discovery ──
    private List<String> discoverAPIs(String baseUrl) {
        List<String> found = new ArrayList<>();
        String[] paths = {"/api", "/api/v1", "/api/v2", "/graphql", "/rest", "/api/health",
                "/api/status", "/api/users", "/api/auth", "/swagger.json", "/openapi.json",
                "/api-docs", "/.well-known/openid-configuration"};
        for (String path : paths) {
            try {
                HttpURLConnection conn = (HttpURLConnection) new URL(baseUrl + path).openConnection();
                conn.setRequestMethod("GET");
                conn.setConnectTimeout(2000);
                conn.setReadTimeout(2000);
                int code = conn.getResponseCode();
                if (code >= 200 && code < 404) found.add(path + " (" + code + ")");
                conn.disconnect();
            } catch (Exception ignored) {}
        }
        return found;
    }

    // ── 18. Subdomain Enumeration ──
    private List<String> enumerateSubdomains(String baseUrl) {
        List<String> found = new ArrayList<>();
        try {
            String host = new URL(baseUrl).getHost();
            String domain = host.startsWith("www.") ? host.substring(4) : host;
            String[] subs = {"mail", "ftp", "admin", "api", "dev", "staging", "test", "app", "dashboard", "cdn", "blog", "shop"};
            for (String sub : subs) {
                try {
                    InetAddress addr = InetAddress.getByName(sub + "." + domain);
                    found.add(sub + "." + domain + " → " + addr.getHostAddress());
                } catch (UnknownHostException ignored) {}
            }
        } catch (Exception ignored) {}
        return found;
    }

    // ── 19. Redirect Chain ──
    private List<String> traceRedirects(String url) {
        List<String> chain = new ArrayList<>();
        try {
            String current = url;
            for (int i = 0; i < 10; i++) {
                HttpURLConnection conn = (HttpURLConnection) new URL(current).openConnection();
                conn.setInstanceFollowRedirects(false);
                conn.setConnectTimeout(3000);
                int code = conn.getResponseCode();
                chain.add(code + " → " + current);
                if (code >= 300 && code < 400) {
                    current = conn.getHeaderField("Location");
                    if (current == null) break;
                } else {
                    break;
                }
                conn.disconnect();
            }
        } catch (Exception e) {
            chain.add("Erro: " + e.getMessage());
        }
        return chain;
    }

    // ── 20. Open Graph / Meta ──
    private Map<String, String> extractOpenGraph(Document doc) {
        Map<String, String> og = new LinkedHashMap<>();
        for (Element meta : doc.select("meta[property^=og:]")) {
            og.put(meta.attr("property"), meta.attr("content"));
        }
        for (Element meta : doc.select("meta[name^=twitter:]")) {
            og.put(meta.attr("name"), meta.attr("content"));
        }
        return og;
    }

    // ── 21. Inline Script Analysis ──
    private Map<String, Object> analyzeInlineScripts(Document doc) {
        Map<String, Object> result = new LinkedHashMap<>();
        int count = 0;
        List<String> suspicious = new ArrayList<>();
        for (Element script : doc.select("script:not([src])")) {
            count++;
            String text = script.html();
            if (text.contains("eval(")) suspicious.add("eval() detectado");
            if (text.contains("document.write")) suspicious.add("document.write() detectado");
            if (text.contains("atob(")) suspicious.add("atob() (Base64 decode) detectado");
            if (text.contains("localStorage") || text.contains("sessionStorage")) suspicious.add("Storage API em uso");
        }
        result.put("count", count);
        result.put("suspicious", suspicious);
        return result;
    }

    // ── 22. DNS Resolve ──
    private Map<String, Object> resolveDNS(String baseUrl) {
        Map<String, Object> dns = new LinkedHashMap<>();
        try {
            String host = new URL(baseUrl).getHost();
            InetAddress[] addrs = InetAddress.getAllByName(host);
            List<String> ips = new ArrayList<>();
            for (InetAddress a : addrs) ips.add(a.getHostAddress());
            dns.put("host", host);
            dns.put("ips", ips);
        } catch (Exception e) {
            dns.put("error", e.getMessage());
        }
        return dns;
    }

    // ── Helpers ──
    private String findHeader(Map<String, String> headers, String name) {
        for (Map.Entry<String, String> e : headers.entrySet()) {
            if (e.getKey().equalsIgnoreCase(name)) return e.getValue();
        }
        return null;
    }

    private String fetchText(String url) {
        try {
            HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
            conn.setConnectTimeout(3000);
            conn.setReadTimeout(3000);
            if (conn.getResponseCode() != 200) return null;
            BufferedReader br = new BufferedReader(new InputStreamReader(conn.getInputStream()));
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = br.readLine()) != null) sb.append(line).append("\n");
            br.close();
            return sb.toString();
        } catch (Exception e) {
            return null;
        }
    }
}
