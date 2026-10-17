import { useEffect, useState } from "react";
import { api } from "./api";

export function App() {
  const [nodes, setNodes] = useState<number | null | "unreachable">(null);

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

  const status =
    nodes === null
      ? "Checking backend..."
      : nodes === "unreachable"
        ? "Backend not reachable"
        : `Backend connected: ${String(nodes)} nodes in the graph`;

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">Tribal</h1>
      <p role="status">{status}</p>
    </main>
  );
}
