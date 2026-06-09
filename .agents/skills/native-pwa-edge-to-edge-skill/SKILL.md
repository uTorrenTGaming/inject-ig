---
name: native-pwa-edge-to-edge-skill
description: Progressive Web App (PWA) Native Architect. Especialista em configurações avançadas para Web Apps que se comportam exatamente como Apps iOS/Android instalados nativamente. Exige uso rigoroso de `viewport-fit=cover`, safe areas, e remoção absoluta da interface do navegador.
license: MIT
metadata:
  author: antigravity
  version: "1.0.0"
---

# Native PWA & Edge-to-Edge Skill

This skill enforces strict PWA and viewport rules to ensure a web application is visually indistinguishable from a native iOS or Android app when installed to the Home Screen.

## 1. EDGE-TO-EDGE VIEWPORT [CRITICAL]

To achieve a true native look, the app MUST paint underneath the notch/Dynamic Island and the home indicator.
*   **Viewport Meta Tag:** The global viewport meta tag MUST include `viewport-fit=cover`.
    ```html
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover, maximum-scale=1.0, user-scalable=no" />
    ```
*   **CSS Safe Area Insets:** When `viewport-fit=cover` is active, you MUST pad critical interactive elements (like buttons or navigation bars) using the system environment variables:
    ```css
    padding-top: env(safe-area-inset-top);
    padding-bottom: env(safe-area-inset-bottom);
    padding-left: env(safe-area-inset-left);
    padding-right: env(safe-area-inset-right);
    ```
*   **Background Bleed:** The `<body>` or the main wrapper background color MUST bleed into the safe areas. Do not constrain the main background inside safe-area-insets.

## 2. NATIVE STATUS BAR (iOS & Android)

*   **iOS Status Bar Style:** To overlay the battery/clock natively on top of the web app's background without a black/white bar, you MUST use:
    ```html
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    ```
*   **Android Theme Color:** The `<meta name="theme-color" content="#000000" />` MUST match the exact background color of the header or current screen.

## 3. PWA MANIFEST CONFIGURATION

The `manifest.json` MUST be configured to remove all browser chrome (URL bar, bottom nav).
*   **Display Mode:** Set `"display": "standalone"` or `"display": "fullscreen"`.
*   **Icons & Splash Screens:** The app MUST provide high-resolution Apple Touch Icons (`<link rel="apple-touch-icon">`) and iOS splash screens using `<link rel="apple-touch-startup-image">`.

## 4. GESTURE & INTERACTION OVERRIDES

Web apps feel "fake" when standard browser gestures trigger.
*   **Disable Pull-to-Refresh:** Use `overscroll-behavior-y: none;` on the `body` or scrollable containers to prevent the browser's native bounce/reload.
*   **Disable Highlight & Select:** Use `-webkit-user-select: none; user-select: none;` on interactive UI elements (buttons, nav links, icons) to prevent the blue highlight box or the text-selection magnifier from appearing during long presses.
*   **Native Touch Feedback:** Use `opacity` or `-webkit-tap-highlight-color: transparent;` combined with CSS `:active` scaling (`scale: 0.95`) to mimic native button presses.
