import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { ReactFlow, Background, Controls, MiniMap, type Node, type Edge } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { apiFetch } from "../lib/api-client";
import type { FileGraphResponse } from "../types";
import { EmptyState, EmptyStateIcon, EmptyStateTitle, EmptyStateDescription } from "../components/ui/empty-state";
import { Loader2, GitBranch } from "lucide-react";

function toFlowElements(graph: FileGraphResponse): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = graph.nodes.map((n, i) => ({
    id: n.id,
    position: { x: (i % 6) * 220, y: Math.floor(i / 6) * 140 },
    data: { label: n.path.split("/").pop() ?? n.path, fullPath: n.path, symbolCount: n.symbolCount },
    style: {
      background: "var(--canvas-soft)",
      border: "1px solid var(--hairline)",
      borderRadius: 8,
      color: "var(--ink)",
      fontSize: 12,
      padding: 8,
      width: 180,
    },
  }));
  const edges: Edge[] = graph.edges.map((e) => {
    const total = e.counts.CALLS + e.counts.IMPORTS + e.counts.EXTENDS + e.counts.IMPLEMENTS;
    const dominant = (Object.entries(e.counts) as Array<[string, number]>).sort((a, b) => b[1] - a[1])[0]![0];
    return {
      id: `${e.source}-${e.target}`,
      source: e.source,
      target: e.target,
      label: total > 1 ? String(total) : undefined,
      style: { stroke: dominant === "IMPORTS" ? "var(--mute)" : "var(--color-success)" },
    };
  });
  return { nodes, edges };
}

export function RepositoryArchitecture() {
  const { id } = useParams();
  const [graph, setGraph] = useState<FileGraphResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadFileGraph = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch<FileGraphResponse>(`/repositories/${id}/graph`);
      setGraph(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load architecture graph");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadFileGraph();
  }, [loadFileGraph]);

  if (loading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-mute" />
      </div>
    );
  }

  if (error) {
    return <p className="text-[14px] text-error-deep bg-error-soft p-sm rounded-xs">{error}</p>;
  }

  if (!graph || graph.nodes.length === 0) {
    return (
      <EmptyState className="border border-hairline bg-canvas">
        <EmptyStateIcon>
          <GitBranch className="w-8 h-8 text-mute" />
        </EmptyStateIcon>
        <EmptyStateTitle>No relationships found</EmptyStateTitle>
        <EmptyStateDescription>
          This repository has no indexed call or import relationships yet.
        </EmptyStateDescription>
      </EmptyState>
    );
  }

  const { nodes, edges } = toFlowElements(graph);

  return (
    <div className="h-[calc(100vh-220px)] min-h-[400px] w-full border border-hairline rounded-md overflow-hidden">
      <ReactFlow nodes={nodes} edges={edges} fitView colorMode="dark">
        <Background />
        <Controls />
        <MiniMap pannable zoomable />
      </ReactFlow>
    </div>
  );
}
