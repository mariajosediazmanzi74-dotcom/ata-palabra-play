import { useMemo } from "react";

const COLORS = ["var(--pink)", "var(--sun)", "var(--sky)", "var(--mint)", "var(--lilac)", "var(--tangerine)"];

// Deterministic pseudo-random so server and browser render the same pieces.
function rand(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

/** Gentle confetti always drifting in the shop. */
export function AmbientConfetti({ count = 18 }: { count?: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: rand(i + 1) * 100,
        delay: -rand(i + 7) * 14,
        dur: 9 + rand(i + 3) * 8,
        size: 6 + rand(i + 5) * 7,
        drift: (rand(i + 11) - 0.5) * 80,
        color: COLORS[i % COLORS.length],
        round: i % 3 === 0,
      })),
    [count],
  );
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="absolute top-0 opacity-80"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.round ? p.size : p.size * 0.45,
            borderRadius: p.round ? "9999px" : "2px",
            background: p.color,
            animation: `drift-down ${p.dur}s linear ${p.delay}s infinite`,
            ["--drift" as string]: `${p.drift}px`,
          }}
        />
      ))}
    </div>
  );
}

/** Big burst when a conversation is completed. */
export function ConfettiBurst({ burstKey }: { burstKey: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 70 }, (_, i) => ({
        left: rand(i + burstKey * 13) * 100,
        delay: rand(i + 2 + burstKey) * 0.8,
        dur: 2.2 + rand(i + 4 + burstKey) * 1.8,
        size: 8 + rand(i + 6) * 9,
        drift: (rand(i + 9 + burstKey) - 0.5) * 220,
        color: COLORS[i % COLORS.length],
      })),
    [burstKey],
  );
  if (!burstKey) return null;
  return (
    <div key={burstKey} aria-hidden className="pointer-events-none absolute inset-0 z-40 overflow-hidden">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="absolute top-0"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 0.5,
            borderRadius: "2px",
            background: p.color,
            animation: `confetti-fall ${p.dur}s cubic-bezier(.2,.6,.4,1) ${p.delay}s both`,
            ["--drift" as string]: `${p.drift}px`,
          }}
        />
      ))}
    </div>
  );
}
