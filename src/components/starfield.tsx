"use client";

import * as React from "react";

interface Star {
  x: number;
  y: number;
  r: number;
  d: number;
}

const STARS: Star[] = Array.from({ length: 80 }, (_, i) => ({
  x: (i * 9301 + 49297) % 100,
  y: (i * 233280 + 12345) % 100,
  r: ((i * 1103515245 + 12345) % 100) / 100 < 0.15 ? 1.4 : 0.7,
  d: ((i * 7919) % 30) / 10,
}));

const SPARKLES = [
  { left: "12%", top: "18%", size: 14, delay: 0 },
  { left: "68%", top: "12%", size: 18, delay: 0.4 },
  { left: "84%", top: "32%", size: 12, delay: 0.8 },
  { left: "22%", top: "62%", size: 16, delay: 1.2 },
  { left: "78%", top: "70%", size: 14, delay: 1.6 },
  { left: "48%", top: "22%", size: 10, delay: 2.0 },
];

export function Starfield() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden moon-glow"
    >
      {/* Estrellitas estilo logo (✦) */}
      {SPARKLES.map((s, i) => (
        <Sparkle key={i} {...s} />
      ))}

      {/* Estrellas pequeñas distribuidas */}
      <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
        {STARS.map((s, i) => (
          <circle
            key={i}
            cx={`${s.x}%`}
            cy={`${s.y}%`}
            r={s.r}
            fill="currentColor"
            className="text-primary/30 animate-twinkle"
            style={{ animationDelay: `${s.d}s` }}
          />
        ))}
      </svg>

      {/* Luna creciente atmosférica */}
      <div className="absolute -right-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute -left-40 bottom-0 h-[24rem] w-[24rem] rounded-full bg-accent/10 blur-3xl" />
    </div>
  );
}

function Sparkle({
  left,
  top,
  size,
  delay,
}: {
  left: string;
  top: string;
  size: number;
  delay: number;
}) {
  return (
    <svg
      className="absolute text-primary/50 animate-twinkle"
      style={{ left, top, width: size, height: size, animationDelay: `${delay}s` }}
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M12 0 L13.5 10.5 L24 12 L13.5 13.5 L12 24 L10.5 13.5 L0 12 L10.5 10.5 Z" />
    </svg>
  );
}
