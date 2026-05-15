package com.nexus.core_engine.service;

import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.*;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class LocalHarvesterService {

    private static final String REGEX_EMAIL = "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,6}";
    private static final String REGEX_JWT = "eyJ[A-Za-z0-9-_=]+\\.[A-Za-z0-9-_=]+\\.?[A-Za-z0-9-_.+/=]*";
    private static final String REGEX_STRIPE = "sk_live_[0-9a-zA-Z]{24}";
    private static final String REGEX_AWS = "AKIA[0-9A-Z]{16}";

    public Map<String, Object> scanLocalDirectory(String folderPath) {
        Map<String, Object> harvestResult = new HashMap<>();
        
        List<String> emailsFound = new ArrayList<>();
        List<String> jwtTokens = new ArrayList<>();
        List<String> stripeKeys = new ArrayList<>();
        List<String> awsKeys = new ArrayList<>();
        List<String> exposedPaths = new ArrayList<>();
        List<String> scripts = new ArrayList<>();
        
        try {
            Path startPath = Paths.get(folderPath);
            
            Files.walkFileTree(startPath, new SimpleFileVisitor<Path>() {
                @Override
                public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) throws IOException {
                    String fileName = file.getFileName().toString();
                    String absolutePath = file.toAbsolutePath().toString();

                    // Ignorar node_modules pesados e pastas git
                    if (absolutePath.contains("node_modules") || absolutePath.contains(".git/objects")) {
                        return FileVisitResult.CONTINUE;
                    }

                    // Gravar rotas sensíveis encontradas localmente
                    if (fileName.equals(".env") || fileName.equals("docker-compose.yml") || fileName.equals("wp-config.php") || fileName.equals("id_rsa")) {
                        exposedPaths.add(absolutePath);
                    }

                    if (fileName.endsWith(".js") || fileName.endsWith(".ts")) {
                        scripts.add(absolutePath);
                    }

                    // Lê o arquivo para regex (apenas arquivos menores que 2MB para não explodir memória)
                    if (Files.size(file) < 2000000 && !fileName.endsWith(".png") && !fileName.endsWith(".jpg")) {
                        String content = new String(Files.readAllBytes(file));
                        extractAndAdd(content, REGEX_EMAIL, emailsFound);
                        extractAndAdd(content, REGEX_JWT, jwtTokens);
                        extractAndAdd(content, REGEX_STRIPE, stripeKeys);
                        extractAndAdd(content, REGEX_AWS, awsKeys);
                    }

                    return FileVisitResult.CONTINUE;
                }
            });

            harvestResult.put("emails_found", emailsFound);
            harvestResult.put("jwt_tokens", jwtTokens);
            harvestResult.put("stripe_keys", stripeKeys);
            harvestResult.put("aws_keys", awsKeys);
            harvestResult.put("exposed_paths", exposedPaths);
            harvestResult.put("env_exposed", exposedPaths.stream().anyMatch(p -> p.endsWith(".env")));
            
            Map<String, Object> archMap = new HashMap<>();
            archMap.put("scripts", scripts);
            archMap.put("links", new ArrayList<>()); // Links doesn't apply the same way to local files
            archMap.put("form_endpoints", new ArrayList<>());
            archMap.put("server", "LOCAL_FILESYSTEM");
            archMap.put("x_powered_by", "OS_FILESYSTEM");
            
            harvestResult.put("architecture", archMap);
            harvestResult.put("status", "LOCAL_HARVEST_COMPLETE");

        } catch (Exception e) {
            harvestResult.put("status", "LOCAL_HARVEST_FAILED");
            harvestResult.put("error", e.getMessage());
        }

        return harvestResult;
    }

    private void extractAndAdd(String source, String regex, List<String> list) {
        Pattern pattern = Pattern.compile(regex);
        Matcher matcher = pattern.matcher(source);
        while (matcher.find()) {
            if (!list.contains(matcher.group())) {
                list.add(matcher.group());
            }
        }
    }
}
