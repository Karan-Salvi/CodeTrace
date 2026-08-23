import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { ReactFlow, Background, Controls, MiniMap, type Node, type Edge } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { apiFetch } from "../lib/api-client";
import type { FileGraphResponse, SymbolGraphResponse } from "../types";
import { EmptyState, EmptyStateIcon, EmptyStateTitle, EmptyStateDescription } from "../components/ui/empty-state";
import { Loader2, GitBranch, ChevronLeft, ChevronRight } from "lucide-react";

function fileGraphToFlow(graph: FileGraphResponse): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = graph.nodes.map((n, i) => ({
    id: n.id,
    position: { x: (i % 6) * 220, y: Math.floor(i / 6) * 140 },
    data: { label: n.path.split("/").pop() ?? n.path },
    style: {
      background: "var(--canvas-soft)", border: "1px solid var(--hairline)", borderRadius: 8,
      color: "var(--ink)", fontSize: 12, padding: 8, width: 180,
    },
  }));
  const edges: Edge[] = graph.edges.map((e) => {
    const total = e.counts.CALLS + e.counts.IMPORTS + e.counts.EXTENDS + e.counts.IMPLEMENTS;
    const dominant = (Object.entries(e.counts) as Array<[string, number]>).sort((a, b) => b[1] - a[1])[0]![0];
    return {
      id: `${e.source}-${e.target}`, source: e.source, target: e.target,
      label: total > 1 ? String(total) : undefined,
      style: { stroke: dominant === "IMPORTS" ? "var(--mute)" : "var(--color-success)" },
    };
  });
  return { nodes, edges };
}

function symbolGraphToFlow(graph: SymbolGraphResponse): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = graph.nodes.map((n, i) => ({
    id: n.id,
    position: { x: (i % 6) * 200, y: Math.floor(i / 6) * 120 },
    data: { label: n.symbol },
    style: {
      background: n.external ? "var(--canvas)" : "var(--canvas-soft)",
      border: n.id === graph.root ? "1px solid var(--color-success)" : "1px solid var(--hairline)",
      borderRadius: 8, color: n.external ? "var(--mute)" : "var(--ink)", fontSize: 12, padding: 8, width: 160,
      fontStyle: n.external ? "italic" : "normal",
    },
  }));
  const edges: Edge[] = graph.edges.map((e) => ({
    id: `${e.source}-${e.target}-${e.type}`,
    source: e.source,
    target: e.target,
    style: { stroke: e.type === "IMPORTS" ? "var(--mute)" : "var(--color-success)" },
  }));
  return { nodes, edges };
}

export function RepositoryArchitecture() {
  const { id } = useParams();
  const [fileGraph, setFileGraph] = useState<FileGraphResponse | null>(null);
  const [symbolGraph, setSymbolGraph] = useState<SymbolGraphResponse | null>(null);
  const [popoverFile, setPopoverFile] = useState<{ path: string; topSymbols: FileGraphResponse["nodes"][number]["topSymbols"] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [drillLoading, setDrillLoading] = useState(false);
  const [error, setError] = useState("");

  const loadFileGraph = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch<FileGraphResponse>(`/repositories/${id}/graph`);
      setFileGraph(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load architecture graph");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadFileGraph();
  }, [loadFileGraph]);

  const handleFileNodeClick = (_: unknown, node: Node) => {
    const file = fileGraph?.nodes.find((n) => n.id === node.id);
    if (!file) return;
    setPopoverFile({ path: file.path, topSymbols: file.topSymbols });
  };

  const drillIntoSymbol = async (chunkId: string) => {
    if (!id) return;
    setPopoverFile(null);
    setDrillLoading(true);
    setError("");
    try {
      const data = await apiFetch<SymbolGraphResponse>(
        `/repositories/${id}/graph?scope=symbol&root=${encodeURIComponent(chunkId)}`
      );
      setSymbolGraph(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load symbol graph");
    } finally {
      setDrillLoading(false);
    }
  };

  const backToFileView = () => setSymbolGraph(null);

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

  if (!fileGraph || fileGraph.nodes.length === 0) {
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

  const showingSymbol = symbolGraph !== null;
  const { nodes, edges } = showingSymbol ? symbolGraphToFlow(symbolGraph) : fileGraphToFlow(fileGraph);

  return (
    <div className="flex flex-col gap-sm">
      {showingSymbol && (
        <button
          type="button"
          onClick={backToFileView}
          className="flex items-center gap-xxs text-[13px] text-mute hover:text-ink transition-colors w-fit"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Back to file view
        </button>
      )}
      <div className="h-[calc(100vh-260px)] min-h-[400px] w-full border border-hairline rounded-md overflow-hidden relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          fitView
          colorMode="dark"
          onNodeClick={showingSymbol ? undefined : handleFileNodeClick}
        >
          <Background />
          <Controls />
          <MiniMap pannable zoomable />
        </ReactFlow>
        {drillLoading && (
          <div className="absolute inset-0 bg-canvas/60 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-mute" />
          </div>
        )}
        {popoverFile && (
          <div className="absolute top-sm left-sm bg-canvas border border-hairline rounded-md shadow-lg p-sm w-[240px] max-w-[calc(100%-16px)]">
            <p className="text-[12px] font-mono text-mute mb-xs truncate">{popoverFile.path}</p>
            <ul className="flex flex-col gap-xxs">
              {popoverFile.topSymbols.map((s) => (
                <li key={s.chunkId}>
                  <button
                    type="button"
                    onClick={() => drillIntoSymbol(s.chunkId)}
                    className="w-full text-left text-[13px] text-ink hover:text-link transition-colors flex items-center justify-between gap-xs px-xs py-xxs rounded-xs hover:bg-canvas-soft"
                  >
                    <span className="truncate">{s.symbol}</span>
                    <ChevronRight className="w-3.5 h-3.5 shrink-0 text-mute" />
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setPopoverFile(null)}
              className="mt-xs text-[12px] text-mute hover:text-ink transition-colors"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
