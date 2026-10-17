import { useEffect, useState } from "react";
import { api } from "./api";
import { AskScreen } from "./screens/AskScreen";
import { RiskMapScreen } from "./screens/RiskMapScreen";
import { SimulationScreen } from "./screens/SimulationScreen";

const SCREENS = [
  { hash: "#risk", title: "Risk map", Screen: RiskMapScreen },
  {
    hash: "#simulate",
    title: "Departure simulation",
    Screen: SimulationScreen,
  },
  { hash: "#ask", title: "Ask", Screen: AskScreen },
] as const;

function currentScreen() {
  return SCREENS.find((screen) => screen.hash === location.hash) ?? SCREENS[0];
}

export function App() {
  const [nodes, setNodes] = useState<number | null | "unreachable">(null);
  const [screen, setScreen] = useState(currentScreen);

  useEffect(() => {
    api.api.health
      .$get()
      .then((response) => response.json())
      .then((body) => {
        setNodes(body.nodes);
      })
      .catch(() => {
        setNodes("unreachable");
      });
  }, []);

  useEffect(() => {
    const onHashChange = () => {
      setScreen(currentScreen());
    };
    window.addEventListener("hashchange", onHashChange);
    return () => {
      window.removeEventListener("hashchange", onHashChange);
    };
  }, []);

  useEffect(() => {
    document.title = `${screen.title} · Tribal`;
  }, [screen]);

  const status =
    nodes === null
      ? "Checking backend..."
      : nodes === "unreachable"
        ? "Backend not reachable"
        : `Backend connected: ${String(nodes)} nodes in the graph`;

  return (
    <div className="mx-auto max-w-7xl p-4 text-slate-900 sm:p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Tribal</h1>
        <p className="text-slate-600">Knowledge risk for FalkorDB/FalkorDB</p>
        <nav aria-label="Screens" className="mt-4 flex flex-wrap gap-2">
          {SCREENS.map(({ hash, title }) => (
            <a
              key={hash}
              href={hash}
              aria-current={hash === screen.hash ? "page" : undefined}
              className="rounded px-3 py-1 text-slate-700 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 focus-visible:outline-none aria-[current=page]:bg-slate-900 aria-[current=page]:text-white"
            >
              {title}
            </a>
          ))}
        </nav>
      </header>
      <main>
        <screen.Screen />
      </main>
      <footer className="mt-8 border-t border-slate-200 pt-4 text-sm text-slate-600">
        <p role="status">{status}</p>
      </footer>
    </div>
  );
}
