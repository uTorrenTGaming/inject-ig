---
name: creative-3d-motion-skill
description: Creative Web Developer. Especialista nível Awwwards em arquitetura de front-end criativa, GSAP, Lenis (Smooth Scroll), React Three Fiber (R3F) e pré-carregamento avançado de mídia pesada para experiências visuais "Estilo Apple". Ativar sempre que o usuário solicitar 3D, scrolltelling avançado, GSAP ou interações cinematográficas.
license: MIT
metadata:
  author: antigravity
  version: "1.0.0"
---

# Creative 3D & Motion Engineering Skill

This skill enforces strict performance and architectural guidelines for building highly interactive, "Awwwards-level", Apple-like web experiences using React/Next.js.

## 1. GSAP & SCROLLTELLING ARCHITECTURE

When implementing complex scroll animations (Scrolljacking, Parallax, Pinned Sections):
*   **Lenis Integration [MANDATORY]:** Native browser scroll is banned for high-end experiences. You MUST implement `lenis` for smooth scrolling and synchronize it with `ScrollTrigger.update`.
*   **React Context & Cleanup [CRITICAL]:** `useEffect` blocks utilizing GSAP MUST contain a rigorous cleanup function. `ScrollTrigger.getAll().forEach(t => t.kill())` is mandatory to prevent massive memory leaks during React routing.
*   **Hardware Acceleration:** Animate strictly via `transform` (x, y, scale, rotate) and `opacity`. NEVER animate CSS properties that trigger layout thrashing (`width`, `height`, `top`, `left`). Use `will-change: transform` intelligently on heavily animated elements.
*   **The Apple "Fade-Up":** Use custom spring easing for reveals. Example: `gsap.to(el, { y: 0, opacity: 1, duration: 1.2, ease: "power3.out" })`.

## 2. PRE-LOADING HEAVY MEDIA (THE APPLE EFFECT)

When implementing frame-by-frame image sequences or massive video backgrounds:
*   **Image Sequence Preloading:**
    *   Do not rely on the browser to load 60+ images dynamically on scroll.
    *   Create an explicit preloader using JS `Image` objects.
    *   Store preloaded frames in a ref array (`useRef<HTMLImageElement[]>([])`) off-thread.
    *   Only reveal the `<canvas>` component to the user when `progress === 100%`.
*   **Canvas Rendering [CRITICAL]:** Do not use 60 overlapping `<img>` tags. Use a single `<canvas>` and draw the preloaded image into `ctx.drawImage` triggered by GSAP `ScrollTrigger` updates. Use `requestAnimationFrame` to ensure 60fps painting.
*   **Video Backgrounds:**
    *   Always use `playsInline`, `muted`, `loop`, and `preload="auto"`.
    *   Compress videos aggressively (H.264/H.265 or VP9/WebM) and ALWAYS provide a lightweight `poster` image (WebP).

## 3. THREE.JS & REACT THREE FIBER (R3F) PERFORMANCE

When generating 3D scenes:
*   **React Render Loop [CRITICAL]:** NEVER instantiate materials (`new THREE.MeshStandardMaterial()`) or geometries directly within the main component body, as this recreates them on every React render.
*   **UseMemo is Mandatory:** Always wrap geometries and materials in `useMemo` to reuse the instances across renders.
*   **Drei Library:** Actively utilize `@react-three/drei` for performance utilities (e.g., `<Instances>`, `<BakeShadows>`, `<Environment>`).
*   **Lighting over Polygons:** Premium 3D isn't about massive polycounts; it's about cinematic lighting. Always use an HDRI Environment map (`<Environment preset="city" />`) mixed with a key directional light, rather than flat ambient light.
*   **Post-Processing Caution:** Bloom, Grain, and Chromatic Aberration (`@react-three/postprocessing`) look amazing but kill mobile performance. If implemented, always wrap them in a conditional check for device performance or disable on mobile viewports.

## 4. UI/UX "ANTI-SLOP"

*   **Custom Cursors:** If a custom cursor is requested, it MUST be a highly performant `fixed` div tracking `e.clientX/Y` using GSAP or Framer Motion outside of the React render cycle (via `useMotionValue` / `useTransform`). Native cursors should be hidden via `cursor-none`.
*   **Magnetic Elements:** Buttons and interactive cards should utilize "magnetic pull" on hover, calculating the distance between the mouse and the element's geometric center.
*   **Typography Sizing:** Use extreme contrast in typography scale. Massive headlines (`text-7xl` to `text-[10vw]`) paired with tiny, well-kerned secondary text (`text-xs uppercase tracking-widest`).
