package com.nexus.core_engine.service;

import org.jsoup.Connection;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class IntelligenceScannerService {

    public Map<String, Object> scanTarget(String url) {
        Map<String, Object> report = new HashMap<>();
        report.put("target", url);

        try {
            Connection.Response res = Jsoup.connect(url)
                    .userAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36")
                    .timeout(10000)
                    .execute();
            
            Document doc = res.parse();

            report.put("title", doc.title());
            
            // Server & Headers Scanner
            report.put("server", res.header("Server") != null ? res.header("Server") : "Oculto");
            report.put("x_powered_by", res.header("X-Powered-By") != null ? res.header("X-Powered-By") : "Oculto");

            // Extract Meta Data (Tech Stack clues)
            List<String> metaTags = new ArrayList<>();
            doc.select("meta").forEach(meta -> {
                String name = meta.attr("name");
                String content = meta.attr("content");
                if (!name.isEmpty() && !content.isEmpty()) {
                    metaTags.add(name + ": " + content);
                }
            });
            report.put("meta", metaTags);

            // Extract all Scripts (React, Next, Vue chunks)
            List<String> scripts = new ArrayList<>();
            doc.select("script").forEach(script -> {
                String src = script.attr("src");
                if (!src.isEmpty()) scripts.add(src);
            });
            report.put("scripts", scripts);

            // Extract API Endpoints from Forms (Login/Register paths)
            List<String> forms = new ArrayList<>();
            doc.select("form").forEach(form -> {
                String action = form.attr("action");
                String method = form.attr("method");
                if (!action.isEmpty()) forms.add(method.toUpperCase() + " -> " + action);
            });
            report.put("form_endpoints", forms);

            // Structure Map
            List<String> links = new ArrayList<>();
            doc.select("a[href]").forEach(link -> links.add(link.attr("abs:href")));
            report.put("links", links);

            report.put("status", "SUCCESS");

        } catch (IOException e) {
            report.put("status", "FAILED");
            report.put("error", e.getMessage());
        }

        return report;
    }
}
