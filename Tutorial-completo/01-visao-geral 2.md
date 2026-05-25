# Visão Geral do Sistema (inject-ig)

Bem-vindo ao tutorial oficial do `inject-ig`. Esta pasta de segurança contém uma plataforma completa de Inteligência, Reconhecimento e Exploração (C2 - Command and Control). 

O sistema é dividido em duas partes principais:
1. **Core Engine (Backend em Java/Spring Boot):** O cérebro da operação.
2. **Console (Frontend em Electron/HTML/JS):** A interface tática onde você gerencia os ataques, visualiza telemetria e controla os usuários.

### Objetivo
O `inject-ig` tem o objetivo de servir como uma suíte avançada de segurança e testes de penetração, permitindo:
- Varreduras Passivas (Scanners de vulnerabilidade, descoberta de portas e OSINT).
- Injeção de Agentes (Payloads em JavaScript injetados diretamente em arquivos HTML para vazar dados).
- Gestão de Acesso via Dashboard Admin com códigos e validades controladas.

Leia os próximos arquivos para entender detalhadamente cada módulo da aplicação.
