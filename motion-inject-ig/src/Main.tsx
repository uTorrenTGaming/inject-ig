import React from 'react';
import { AbsoluteFill, Audio, staticFile, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';

export const Main: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const logoScale = spring({
    fps,
    frame: frame - 10,
    config: { damping: 10, mass: 0.5 },
  });

  const glowOpacity = interpolate(
    Math.sin(frame / 30),
    [-1, 1],
    [0.4, 0.8]
  );

  return (
    <AbsoluteFill style={{ backgroundColor: '#050505', color: '#fff', fontFamily: 'sans-serif' }}>
      <Audio src={staticFile('audio.mp3')} />

      {/* Background Glow */}
      <AbsoluteFill
        style={{
          background: 'radial-gradient(circle at center, rgba(0, 150, 255, 0.2) 0%, transparent 60%)',
          opacity: glowOpacity,
        }}
      />

      {/* Glassmorphism Card */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: `translate(-50%, -50%) scale(${logoScale})`,
          width: '80%',
          height: '60%',
          background: 'rgba(255, 255, 255, 0.05)',
          borderRadius: 40,
          backdropFilter: 'blur(30px)',
          WebkitBackdropFilter: 'blur(30px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 60,
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
        }}
      >
        <h1 style={{ fontSize: 80, fontWeight: 'bold', margin: 0, textAlign: 'center', background: 'linear-gradient(to right, #00f2fe, #4facfe)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Inject-IG
        </h1>
        <p style={{ fontSize: 40, color: 'rgba(255, 255, 255, 0.7)', marginTop: 20, textAlign: 'center' }}>
          Sistema de Vigilância Digital
        </p>
        
        {/* Dynamic visual element representing audio/operation */}
        <div style={{ marginTop: 80, display: 'flex', gap: 10 }}>
          {[...Array(5)].map((_, i) => {
            const barHeight = interpolate(
              Math.sin((frame + i * 15) / 10),
              [-1, 1],
              [20, 100]
            );
            return (
              <div
                key={i}
                style={{
                  width: 15,
                  height: barHeight,
                  background: '#00f2fe',
                  borderRadius: 10,
                  boxShadow: '0 0 10px #00f2fe'
                }}
              />
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
