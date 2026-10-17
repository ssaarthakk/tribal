import type { CSSProperties, ReactNode } from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { COLORS, FONT, RISK_COLORS } from "./theme";

export function useTime(): number {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return frame / fps;
}

export function progress(time: number, start: number, duration = 0.6): number {
  return interpolate(time, [start, start + duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.33, 1, 0.68, 1),
  });
}

export function typed(
  text: string,
  time: number,
  start: number,
  duration: number,
): string {
  return text.slice(
    0,
    Math.round(text.length * progress(time, start, duration)),
  );
}

export function Stage({ children }: { children: ReactNode }) {
  const opacity = progress(useTime(), 0, 0.4);
  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.background,
        color: COLORS.text,
        fontFamily: FONT,
        padding: 96,
        opacity,
      }}
    >
      {children}
    </AbsoluteFill>
  );
}

export function Reveal({
  at,
  children,
  style = {},
}: {
  at: number;
  children: ReactNode;
  style?: CSSProperties;
}) {
  const shown = progress(useTime(), at);
  return (
    <div
      style={{
        ...style,
        opacity: shown,
        transform: "translateY(" + String((1 - shown) * 24) + "px)",
      }}
    >
      {children}
    </div>
  );
}

export function Counter({ at, value }: { at: number; value: number }) {
  const shown = progress(useTime(), at, 1.2);
  return <>{Math.round(value * shown).toLocaleString("en-US")}</>;
}

export function Title({ at, children }: { at: number; children: ReactNode }) {
  return (
    <Reveal at={at}>
      <h1 style={{ fontSize: 64, margin: 0, fontWeight: 700 }}>{children}</h1>
    </Reveal>
  );
}

export function Card({
  children,
  style = {},
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        backgroundColor: COLORS.panel,
        border: "2px solid " + COLORS.border,
        borderRadius: 24,
        padding: 36,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function CriticalBadge() {
  return (
    <span
      style={{
        backgroundColor: RISK_COLORS.critical,
        color: COLORS.background,
        borderRadius: 999,
        padding: "6px 20px",
        fontSize: 26,
        fontWeight: 700,
      }}
    >
      critical
    </span>
  );
}

export function Wordmark({ at }: { at: number }) {
  return (
    <>
      <Reveal at={at}>
        <h1
          style={{
            fontSize: 180,
            margin: 0,
            fontWeight: 800,
            letterSpacing: -4,
          }}
        >
          Tribal
        </h1>
      </Reveal>
      <Reveal at={at + 1.3}>
        <p style={{ fontSize: 56, margin: 0, color: COLORS.accent }}>
          Know what breaks before someone leaves.
        </p>
      </Reveal>
    </>
  );
}
