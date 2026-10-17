import { useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D, { type ForceGraphMethods } from "react-force-graph-2d";
import { DIMMED, HIGHLIGHT } from "../colors";

type GraphNode = { id: string; label: string; color: string; size: number };
type GraphLink = { source: string; target: string };

type GraphViewProps = {
  nodes: GraphNode[];
  links: GraphLink[];
  highlighted?: ReadonlySet<string>;
  dimmed?: ReadonlySet<string>;
  onNodeClick?: (id: string) => void;
  label: string;
};

export function GraphView({
  nodes,
  links,
  highlighted,
  dimmed,
  onNodeClick,
  label,
}: GraphViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<ForceGraphMethods<GraphNode, GraphLink> | undefined>(
    undefined,
  );
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(container);
    return () => {
      observer.disconnect();
    };
  }, []);

  const graphData = useMemo(
    () => ({
      nodes: nodes.map((node) => ({ ...node })),
      links: links.map((link) => ({ ...link })),
    }),
    [nodes, links],
  );

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={label}
      className="rounded border border-slate-200"
    >
      {width > 0 && (
        <ForceGraph2D<GraphNode, GraphLink>
          ref={graphRef}
          graphData={graphData}
          width={width}
          height={480}
          cooldownTicks={100}
          onEngineStop={() => graphRef.current?.zoomToFit(400, 20)}
          nodeCanvasObject={(node, context, globalScale) => {
            const x = node.x ?? 0;
            const y = node.y ?? 0;
            const isHighlighted = highlighted?.has(node.id) ?? false;
            context.beginPath();
            context.arc(x, y, node.size, 0, 2 * Math.PI);
            context.fillStyle = dimmed?.has(node.id) ? DIMMED : node.color;
            context.fill();
            if (isHighlighted) {
              context.lineWidth = 2 / globalScale;
              context.strokeStyle = HIGHLIGHT;
              context.stroke();
            }
            if (isHighlighted || globalScale > 1.5) {
              context.font = `${String(12 / globalScale)}px sans-serif`;
              context.textAlign = "center";
              context.textBaseline = "top";
              context.fillStyle = HIGHLIGHT;
              context.fillText(node.label, x, y + node.size + 2 / globalScale);
            }
          }}
          nodePointerAreaPaint={(node, color, context) => {
            context.beginPath();
            context.arc(node.x ?? 0, node.y ?? 0, node.size, 0, 2 * Math.PI);
            context.fillStyle = color;
            context.fill();
          }}
          onNodeClick={(node) => onNodeClick?.(node.id)}
        />
      )}
    </div>
  );
}
