import * as React from "react";
import { cn } from "@/lib/utils";

interface LogoProps extends React.SVGProps<SVGSVGElement> {
  withText?: boolean;
  size?: number;
}

export function MoonLogo({ className, withText = false, size = 56, ...props }: LogoProps) {
  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      className={cn("text-primary", className)}
      aria-hidden="true"
      {...props}
    >
      <defs>
        <radialGradient id="moonGrad" cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.7" />
          <stop offset="55%" stopColor="currentColor" stopOpacity="0.35" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.15" />
        </radialGradient>
        <linearGradient id="bookGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.55" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.85" />
        </linearGradient>
      </defs>

      {/* Crescent moon */}
      <path
        d="M50 100 a52 52 0 1 0 84 -42 a40 40 0 1 1 -84 42 z"
        fill="url(#moonGrad)"
      />

      {/* Sparkles around */}
      <g fill="currentColor">
        <Sparkle cx={155} cy={48} r={3.2} />
        <Sparkle cx={170} cy={78} r={2.2} />
        <Sparkle cx={140} cy={36} r={1.8} />
        <Sparkle cx={50} cy={140} r={2.2} />
        <Sparkle cx={180} cy={120} r={2.6} />
        <Sparkle cx={120} cy={26} r={1.4} />
      </g>

      {/* Cat silhouette: head with ears, body, tail */}
      <g fill="hsl(var(--foreground))" className="dark:fill-current">
        {/* Body */}
        <path d="M88 132 c-4 -10 -2 -22 6 -30 c8 -8 22 -8 30 -2 c6 4 10 12 10 22 c0 12 -8 22 -22 24 c-12 2 -20 -4 -24 -14z" />
        {/* Head */}
        <ellipse cx="116" cy="98" rx="16" ry="14" />
        {/* Ears */}
        <path d="M104 90 l-6 -14 l8 4 z" />
        <path d="M128 90 l6 -14 l-8 4 z" />
        {/* Tail (curl) */}
        <path
          d="M138 144 c12 4 20 16 18 28 c-2 10 -10 16 -18 14"
          stroke="hsl(var(--foreground))"
          strokeWidth="6"
          fill="none"
          strokeLinecap="round"
        />
      </g>

      {/* Closed eyes (sleepy) */}
      <g
        stroke="hsl(var(--background))"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
        opacity="0.8"
      >
        <path d="M108 96 q3 2 6 0" />
        <path d="M120 96 q3 2 6 0" />
      </g>
      {/* Whiskers */}
      <g stroke="hsl(var(--background))" strokeWidth="0.8" opacity="0.6" fill="none">
        <line x1="100" y1="102" x2="92" y2="100" />
        <line x1="100" y1="105" x2="92" y2="106" />
        <line x1="132" y1="102" x2="140" y2="100" />
        <line x1="132" y1="105" x2="140" y2="106" />
      </g>

      {/* Book */}
      <g>
        <path
          d="M86 134 q14 -6 28 -2 l0 24 q-14 -4 -28 2 z"
          fill="url(#bookGrad)"
        />
        <path
          d="M114 132 q14 -4 28 2 l0 24 q-14 -6 -28 -2 z"
          fill="url(#bookGrad)"
          opacity="0.85"
        />
        <path
          d="M114 132 l0 26"
          stroke="hsl(var(--background))"
          strokeWidth="1"
          opacity="0.6"
        />
      </g>
    </svg>
  );
}

function Sparkle({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <path
      d={`M${cx} ${cy - r * 2.4} L${cx + r * 0.8} ${cy - r * 0.3} L${cx + r * 2.4} ${cy} L${cx + r * 0.8} ${cy + r * 0.3} L${cx} ${cy + r * 2.4} L${cx - r * 0.8} ${cy + r * 0.3} L${cx - r * 2.4} ${cy} L${cx - r * 0.8} ${cy - r * 0.3} Z`}
    />
  );
}

export function MoonWordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-baseline gap-2", className)}>
      <span className="hand-script text-3xl leading-none tracking-tight">Moon</span>
      <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
        Club de Lectura
      </span>
    </span>
  );
}
