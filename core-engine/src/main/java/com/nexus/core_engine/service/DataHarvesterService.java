package com.nexus.core_engine.service;

import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class DataHarvesterService {

    // Regex para Inteligência
    private static final String REGEX_EMAIL = "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,6}";
    private static final String REGEX_JWT = "eyJ[A-Za-z0-9-_=]+\\.[A-Za-z0-9-_=]+\\.?[A-Za-z0-9-_.+/=]*";
    private static final String REGEX_STRIPE = "sk_live_[0-9a-zA-Z]{24}";
    private static final String REGEX_AWS = "AKIA[0-9A-Z]{16}";
    private static final String REGEX_JS_FILE = "src=\"([^\"]+\\.js)\"";

    // Rotas para Brute-Force Silencioso
    private final String[] SENSITIVE_PATHS = {
        "/.env", "/.git/config", "/docker-compose.yml", "/wp-config.php.bak",
        "/admin", "/api/swagger-ui.html", "/backup.zip", "/.ssh/id_rsa", "/config.json"
    };

    public Map<String, Object> harvestData(String targetUrl) {
        Map<String, Object> harvestResult = new HashMap<>();
        
        try {
            String sourceCode = fetchSource(targetUrl);
            
            harvestResult.put("emails_found", extractByRegex(sourceCode, Pattern.compile(REGEX_EMAIL)));
            harvestResult.put("jwt_tokens", extractByRegex(sourceCode, Pattern.compile(REGEX_JWT)));
            harvestResult.put("stripe_keys", extractByRegex(sourceCode, Pattern.compile(REGEX_STRIPE)));
            harvestResult.put("aws_keys", extractByRegex(sourceCode, Pattern.compile(REGEX_AWS)));
            
            // 2. Sensitive Path Brute-Forcer
            List<String> exposedPaths = new ArrayList<>();
            String baseUrl = targetUrl.endsWith("/") ? targetUrl.substring(0, targetUrl.length() - 1) : targetUrl;
            
            for (String path : SENSITIVE_PATHS) {
                if (probeFile(baseUrl, path)) {
                    exposedPaths.add(path);
                }
            }
            harvestResult.put("exposed_paths", exposedPaths);
            harvestResult.put("env_exposed", exposedPaths.contains("/.env"));

            // 3. Source Map Scanner (Very Dangerous React/Vue Exposure)
            List<String> sourceMaps = new ArrayList<>();
            List<String> jsFiles = extractByRegexGroups(sourceCode, Pattern.compile(REGEX_JS_FILE));
            for (String jsFile : jsFiles) {
                String mapUrl = jsFile.startsWith("http") ? jsFile + ".map" : baseUrl + (jsFile.startsWith("/") ? "" : "/") + jsFile + ".map";
                if (probeUrlFull(mapUrl)) {
                    sourceMaps.add(mapUrl);
                }
            }
            harvestResult.put("source_maps_exposed", sourceMaps);

            harvestResult.put("status", "HARVEST_COMPLETE");

        } catch (Exception e) {
            harvestResult.put("status", "HARVEST_FAILED");
            harvestResult.put("error", e.getMessage());
        }

        return harvestResult;
    }

    private List<String> extractByRegex(String source, Pattern pattern) {
        List<String> results = new ArrayList<>();
        Matcher matcher = pattern.matcher(source);
        while (matcher.find()) {
            if (!results.contains(matcher.group())) {
                results.add(matcher.group());
            }
        }
        return results;
    }

    private List<String> extractByRegexGroups(String source, Pattern pattern) {
        List<String> results = new ArrayList<>();
        Matcher matcher = pattern.matcher(source);
        while (matcher.find()) {
            if (!results.contains(matcher.group(1))) {
                results.add(matcher.group(1));
            }
        }
        return results;
    }

    private String fetchSource(String targetUrl) throws Exception {
        URL url = new URL(targetUrl);
        HttpURLConnection con = (HttpURLConnection) url.openConnection();
        con.setRequestMethod("GET");
        con.setRequestProperty("User-Agent", "Mozilla/5.0 inject-ig");
        
        BufferedReader in = new BufferedReader(new InputStreamReader(con.getInputStream()));
        String inputLine;
        StringBuilder content = new StringBuilder();
        while ((inputLine = in.readLine()) != null) {
            content.append(inputLine).append("\n");
        }
        in.close();
        return content.toString();
    }

    private boolean probeFile(String baseUrl, String path) {
        try {
            URL url = new URL(baseUrl.endsWith("/") ? baseUrl + path.substring(1) : baseUrl + path);
            HttpURLConnection con = (HttpURLConnection) url.openConnection();
            con.setRequestMethod("HEAD");
            con.setConnectTimeout(2000);
            int code = con.getResponseCode();
            return code >= 200 && code < 300;
        } catch (Exception e) {
            return false;
        }
    }

    private boolean probeUrlFull(String fullUrl) {
        try {
            URL url = new URL(fullUrl);
            HttpURLConnection con = (HttpURLConnection) url.openConnection();
            con.setRequestMethod("HEAD");
            con.setConnectTimeout(2000);
            int code = con.getResponseCode();
            return code >= 200 && code < 300;
        } catch (Exception e) {
            return false;
        }
    }
}
