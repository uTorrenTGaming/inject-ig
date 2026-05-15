package com.nexus.core_engine.controller;

import com.nexus.core_engine.service.DataHarvesterService;
import com.nexus.core_engine.service.DeepReconService;
import com.nexus.core_engine.service.IntelligenceScannerService;
import com.nexus.core_engine.service.LocalHarvesterService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@RestController
@RequestMapping("/api/inject-ig")
@CrossOrigin(origins = "*")
public class NexusController {

    @Autowired
    private IntelligenceScannerService scannerService;

    @Autowired
    private DataHarvesterService harvesterService;

    @Autowired
    private LocalHarvesterService localHarvesterService;

    @Autowired
    private DeepReconService deepReconService;

    private final Map<String, Object> liveVault = new ConcurrentHashMap<>();
    private final List<Map<String, String>> accessLogs = new ArrayList<>();
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final ExecutorService executor = Executors.newCachedThreadPool();

    @GetMapping("/status")
    public ResponseEntity<Map<String, String>> getStatus() {
        return ResponseEntity.ok(Map.of("core_engine", "ONLINE"));
    }

    @GetMapping("/monitor")
    public ResponseEntity<Map<String, Object>> getLiveFeed() {
        Map<String, Object> feed = new HashMap<>();
        feed.put("vault", liveVault);
        feed.put("access_logs", accessLogs);
        return ResponseEntity.ok(feed);
    }

    // ── SSE Streaming Scan ──
    @GetMapping(value = "/scan-stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter scanStream(@RequestParam String url) {
        SseEmitter emitter = new SseEmitter(120_000L); // 2 min timeout

        executor.execute(() -> {
            Map<String, Object> fullReport = new LinkedHashMap<>();
            fullReport.put("target", url);
            int step = 0;
            int totalSteps = 25; // architecture + harvested_data + 22 deep recon + done

            try {
                // 1. Architecture scan
                step++;
                Map<String, Object> arch = scannerService.scanTarget(url);
                fullReport.put("architecture", arch);
                emitEvent(emitter, "architecture", arch, step, totalSteps);

                // 2. Data harvest
                step++;
                Map<String, Object> harvest = harvesterService.harvestData(url);
                fullReport.put("harvested_data", harvest);
                emitEvent(emitter, "harvested_data", harvest, step, totalSteps);

                // 3-24. Deep recon (individual modules via streaming)
                String baseUrl = url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
                Map<String, Object> deepRecon = deepReconService.deepReconStreamed(baseUrl, (moduleName, moduleResult) -> {
                    try {
                        int s = 3 + getModuleIndex(moduleName);
                        Map<String, Object> wrapper = new LinkedHashMap<>();
                        wrapper.put("module", moduleName);
                        wrapper.put("data", moduleResult);
                        emitEvent(emitter, "deep_recon_" + moduleName, wrapper, Math.min(s, totalSteps - 1), totalSteps);
                    } catch (Exception ignored) {}
                });
                fullReport.put("deep_recon", deepRecon);

                // Store in vault
                liveVault.put(url, fullReport);

                // Final event
                emitter.send(SseEmitter.event()
                        .name("done")
                        .data(objectMapper.writeValueAsString(Map.of("status", "COMPLETE", "step", totalSteps, "total", totalSteps))));
                emitter.complete();

            } catch (Exception e) {
                try {
                    emitter.send(SseEmitter.event()
                            .name("error")
                            .data(objectMapper.writeValueAsString(Map.of("error", e.getMessage() != null ? e.getMessage() : "Unknown error"))));
                    emitter.complete();
                } catch (Exception ignored) {}
            }
        });

        return emitter;
    }

    private void emitEvent(SseEmitter emitter, String name, Object data, int step, int total) {
        try {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("module", name);
            payload.put("result", data);
            payload.put("step", step);
            payload.put("total", total);
            emitter.send(SseEmitter.event()
                    .name(name)
                    .data(objectMapper.writeValueAsString(payload)));
        } catch (Exception ignored) {}
    }

    private int getModuleIndex(String moduleName) {
        String[] modules = {"security_headers", "cookies", "tech_stack", "cms", "cdn_waf", "ssl_cert",
                "robots_txt", "sitemap", "cors", "http_methods", "html_comments", "hidden_inputs",
                "external_services", "social_links", "phone_numbers", "assets", "api_endpoints",
                "subdomains", "redirect_chain", "open_graph", "inline_scripts", "dns"};
        for (int i = 0; i < modules.length; i++) {
            if (modules[i].equals(moduleName)) return i;
        }
        return 0;
    }

    @PostMapping("/scan")
    public ResponseEntity<Map<String, Object>> runFullScan(@RequestBody Map<String, String> payload) {
        String targetUrl = payload.get("url");
        String arch = payload.getOrDefault("arch", "REMOTE_SCAN");
        
        if (targetUrl == null || targetUrl.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Target URL is required"));
        }

        if (arch.equals("MOD_MENU_UI") || arch.equals("CONSOLE_PAYLOAD")) {
            Map<String, String> log = new HashMap<>();
            log.put("time", String.valueOf(System.currentTimeMillis()));
            log.put("target", targetUrl);
            log.put("type", "COMPROMISED_ACCESS");
            log.put("keys", payload.getOrDefault("keys", "NONE"));
            accessLogs.add(log);
            return ResponseEntity.ok(Map.of("status", "LOGGED"));
        }

        Map<String, Object> finalReport = new HashMap<>();
        finalReport.put("target", targetUrl);
        finalReport.put("architecture", scannerService.scanTarget(targetUrl));
        finalReport.put("harvested_data", harvesterService.harvestData(targetUrl));
        finalReport.put("deep_recon", deepReconService.deepRecon(targetUrl));
        
        liveVault.put(targetUrl, finalReport);

        return ResponseEntity.ok(finalReport);
    }

    @PostMapping("/scan-local")
    public ResponseEntity<Map<String, Object>> runLocalScan(@RequestBody Map<String, String> payload) {
        String folderPath = payload.get("path");
        
        if (folderPath == null || folderPath.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Local Path is required"));
        }

        Map<String, Object> finalReport = localHarvesterService.scanLocalDirectory(folderPath);
        finalReport.put("target", folderPath);
        
        liveVault.put(folderPath, finalReport);

        return ResponseEntity.ok(finalReport);
    }
}
