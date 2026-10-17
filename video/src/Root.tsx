import { Composition } from "remotion";
import { Demo } from "./Demo";
import { END_SECONDS } from "./scenes";

const FPS = 30;

export function Root() {
  return (
    <Composition
      id="Demo"
      component={Demo}
      width={1920}
      height={1080}
      fps={FPS}
      durationInFrames={Math.round(END_SECONDS * FPS)}
    />
  );
}
