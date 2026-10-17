import { AbsoluteFill } from "remotion";
import { COLORS } from "../theme";
import { Reveal, Stage, Wordmark } from "../ui";

export function Outro() {
  return (
    <Stage>
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          textAlign: "center",
          gap: 36,
        }}
      >
        <Wordmark at={0.25} />
        <Reveal at={4.55}>
          <p style={{ fontSize: 40, margin: "40px 0 0" }}>
            github.com/ssaarthakk/tribal · tribal.ssaarthakk.me
          </p>
          <p style={{ fontSize: 34, margin: "20px 0 0", color: COLORS.muted }}>
            Graph Hacks · Company Brain track
          </p>
        </Reveal>
      </AbsoluteFill>
    </Stage>
  );
}
