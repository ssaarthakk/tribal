import type { JSX } from "react";
import { Html5Audio, Series, staticFile, useVideoConfig } from "remotion";
import { END_SECONDS, scenes, VOICEOVER, type SceneId } from "./scenes";
import { Ask } from "./views/Ask";
import { Component } from "./views/Component";
import { Falkordb } from "./views/Falkordb";
import { Graph } from "./views/Graph";
import { Handover } from "./views/Handover";
import { Hook } from "./views/Hook";
import { Mcp } from "./views/Mcp";
import { Outro } from "./views/Outro";
import { Problem } from "./views/Problem";
import { RiskMap } from "./views/RiskMap";
import { Simulation } from "./views/Simulation";

const VIEWS: Record<SceneId, () => JSX.Element> = {
  hook: Hook,
  problem: Problem,
  graph: Graph,
  riskMap: RiskMap,
  component: Component,
  simulation: Simulation,
  handover: Handover,
  ask: Ask,
  mcp: Mcp,
  falkordb: Falkordb,
  outro: Outro,
};

export function Demo() {
  const { fps } = useVideoConfig();
  return (
    <>
      <Html5Audio src={staticFile(VOICEOVER)} />
      <Series>
        {scenes.map((scene, index) => {
          const end = scenes[index + 1]?.start ?? END_SECONDS;
          const View = VIEWS[scene.id];
          return (
            <Series.Sequence
              key={scene.id}
              durationInFrames={
                Math.round(end * fps) - Math.round(scene.start * fps)
              }
            >
              <View />
            </Series.Sequence>
          );
        })}
      </Series>
    </>
  );
}
