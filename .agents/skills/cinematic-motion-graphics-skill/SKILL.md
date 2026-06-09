---
name: cinematic-motion-graphics-skill
description: Motion Graphics & Cinematography Developer. Especialista em renderização fotográfica, movimentos de câmera fluidos e suporte total a animações em monitores de 120Hz (ProMotion). Ativar sempre que o usuário solicitar motion design profundo, edição de vídeo no front-end, match cuts ou animações super responsivas.
license: MIT
metadata:
  author: antigravity
  version: "1.0.0"
---

# Cinematic Motion & ProMotion Skill

This skill enforces strict frame-rate agnosticism, dynamic camera interpolation, and photographic post-processing for cutting-edge React & WebGL experiences.

## 1. 120Hz PRO-MOTION ARCHITECTURE

When creating programmatic animations (Canvas, WebGL, or raw `requestAnimationFrame`):
*   **Delta-Time Enforcement [MANDATORY]:** NEVER increment animations using static values per frame (e.g., `position.x += 0.01`). This will cause the animation to run twice as fast on Apple ProMotion (120Hz) displays compared to standard 60Hz displays.
*   **Frame-Rate Independence:** ALWAYS use Delta Time (`useFrame((state, delta) => {})` in R3F). Ensure that: `position.x += speed * delta`.
*   **Hardware Frame Synchronization:** Avoid arbitrary `setTimeout` or `setInterval` for visual transitions. Hook directly into the display's native refresh rate loop.

## 2. CINEMATIC CAMERA MOVEMENTS

When animating cameras in Three.js/R3F:
*   **Spline/Bezier Interpolation:** Cameras must never move in rigid straight lines. Use `THREE.CatmullRomCurve3` or similar spline functions to calculate camera paths, creating a "drone-like" fluidity.
*   **Damping & Inertia:** Use `maath/easing` (`easing.damp3`) or `@react-three/drei`'s `CameraControls` with smooth damping for all camera interactions. The camera must have "weight" and ease out gradually when the user stops interacting.
*   **LookAt Targeting:** Smoothly interpolate the camera's `lookAt` target simultaneously with its position to avoid mechanical panning.

## 3. MATCH CUTS & MORPHING (VIDEO EDITING STYLE)

When transitioning between distinct pages or sections:
*   **Shared Element Transitions:** Use Framer Motion's `layoutId` or the new `ViewTransition` API to create seamless "Match Cuts", where the geometry or image of the outgoing section morphs physically into the incoming section.
*   **Crossfade Masking:** If a 3D environment changes context, use WebGL masked transitions (e.g., a fluid wipe or a zoom-through) rather than a jarring HTML re-render.

## 4. PHOTOGRAPHIC OPTICS & POST-PROCESSING

If processing overhead permits, implement optical realism to heighten immersion:
*   **Dynamic Depth of Field (DoF):** The focal distance must dynamically raycast to the geometry exactly at the center of the viewport, blurring the foreground and background instantly like a real camera lens.
*   **Velocity-Based Motion Blur:** Apply subtle motion blur strictly when the camera is traveling at high speeds between sections to simulate cinematic shutter angles.
*   **Chromatic Aberration:** Use sparsely on the extreme edges of the lens to simulate anamorphic glass.
