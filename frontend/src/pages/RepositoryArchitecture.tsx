import { useEffect, useState, useCallback, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { apiFetch } from "../lib/api-client";
import type { FileGraphResponse, SymbolGraphResponse, RelationshipTypeName } from "../types";
import { EmptyState, EmptyStateIcon, EmptyStateTitle, EmptyStateDescription } from "../components/ui/empty-state";
import {
  Loader2,
  GitBranch,
  ChevronLeft,
  ChevronRight,
  FileCode2,
  Box,
  Shapes,
  Braces,
  Package,
  X,
} from "lucide-react";

// ---------- Custom node cards ----------
// React Flow renders whatever we return here for each node — using real
// design-system classes (not the inline style-object approach) gets
// hover states, truncation, and icon rows for free instead of hand-tuned
// inline CSS.

const handleClass = "!w-2 !h-2 !bg-hairline-strong !border-none";

interface FileNodeData {
  filename: string;
  folder: string;
  symbolCount: number;
  [key: string]: unknown;
}

function FileNode({ data }: NodeProps<Node<FileNodeData>>) {
  return (
    <div className="group w-[200px] rounded-md bg-canvas-soft border border-hairline hover:border-hairline-strong hover:bg-canvas-soft-2 transition-colors cursor-pointer px-sm py-xs">
      <Handle type="target" position={Position.Left} className={handleClass} />
      <div className="flex items-center gap-xs min-w-0">
        <FileCode2 className="w-3.5 h-3.5 text-mute shrink-0" />
        <span className="text-[13px] font-medium text-ink truncate">{data.filename}</span>
      </div>
      {data.folder && <p className="text-[11px] text-mute truncate mt-[2px] pl-[18px]">{data.folder}</p>}
      <div className="flex justify-end mt-xs">
        <span className="text-[10px] font-mono text-mute bg-canvas border border-hairline px-xs rounded-full">
          {data.symbolCount} symbol{data.symbolCount === 1 ? "" : "s"}
        </span>
      </div>
      <Handle type="source" position={Position.Right} className={handleClass} />
    </div>
  );
}

const SYMBOL_TYPE_ICON: Record<string, typeof Box> = {
  FUNCTION: Braces,
  METHOD: Braces,
  CLASS: Box,
  INTERFACE: Shapes,
};

interface SymbolNodeData {
  symbol: string;
  file: string | null;
  startLine: number | null;
  external: boolean;
  isRoot: boolean;
  [key: string]: unknown;
}

function SymbolNode({ data }: NodeProps<Node<SymbolNodeData>>) {
  const Icon = data.external ? Package : SYMBOL_TYPE_ICON[String(data.symbolType ?? "")] ?? Braces;
  return (
    <div
      className={`w-[180px] rounded-md px-sm py-xs transition-colors ${
        data.external
          ? "bg-canvas border border-dashed border-hairline"
          : data.isRoot
            ? "bg-canvas-soft border-2 border-success"
            : "bg-canvas-soft border border-hairline"
      }`}
    >
      <Handle type="target" position={Position.Left} className={handleClass} />
      <div className="flex items-center gap-xs min-w-0">
        <Icon className={`w-3.5 h-3.5 shrink-0 ${data.external ? "text-mute" : "text-success"}`} />
        <span className={`text-[13px] font-medium truncate ${data.external ? "text-mute italic" : "text-ink"}`}>
          {data.symbol}
        </span>
      </div>
      {data.file && (
        <p className="text-[11px] text-mute truncate mt-[2px] pl-[18px]">
          {data.file.split("/").pop()}:{data.startLine}
        </p>
      )}
      <Handle type="source" position={Position.Right} className={handleClass} />
    </div>
  );
}

const fileNodeTypes = { file: FileNode };
const symbolNodeTypes = { symbol: SymbolNode };

// ---------- Layout ----------
// No layout library (react-flow ships none, and pulling in dagre/elkjs
// for a repo-scoped graph that's rarely more than a few dozen nodes is
// more dependency than this needs) — a near-square grid sized to the
// card's real dimensions, ordered by symbolCount so the most-connected
// files cluster toward the top-left, reads far better than a fixed
// 6-column grid that either crowds small repos or stretches thin ones.
const FILE_CARD_W = 200;
const FILE_CARD_H = 90;
const GAP_X = 40;
const GAP_Y = 30;

function fileGraphToFlow(graph: FileGraphResponse): { nodes: Node[]; edges: Edge[] } {
  const ordered = [...graph.nodes].sort((a, b) => b.symbolCount - a.symbolCount);
  const columns = Math.max(1, Math.ceil(Math.sqrt(ordered.length)));

  const nodes: Node[] = ordered.map((n, i) => {
    const col = i % columns;
    const row = Math.floor(i / columns);
    const lastSlash = n.path.lastIndexOf("/");
    return {
      id: n.id,
      type: "file",
      position: { x: col * (FILE_CARD_W + GAP_X), y: row * (FILE_CARD_H + GAP_Y) },
      data: {
        filename: lastSlash >= 0 ? n.path.slice(lastSlash + 1) : n.path,
        folder: lastSlash >= 0 ? n.path.slice(0, lastSlash) : "",
        symbolCount: n.symbolCount,
      },
    };
  });

  const edges: Edge[] = graph.edges.map((e) => {
    const total = e.counts.CALLS + e.counts.IMPORTS + e.counts.EXTENDS + e.counts.IMPLEMENTS;
    const dominant = (Object.entries(e.counts) as Array<[RelationshipTypeName, number]>).sort((a, b) => b[1] - a[1])[0]![0];
    return {
      id: `${e.source}-${e.target}`,
      source: e.source,
      target: e.target,
      label: total > 1 ? String(total) : undefined,
      labelStyle: { fill: "var(--mute)", fontSize: 11 },
      style: { stroke: dominant === "IMPORTS" ? "var(--mute)" : "var(--color-success)", strokeWidth: 1.5 },
    };
  });
  return { nodes, edges };
}

// Root centered; callers (incoming) fan out to the left, callees +
// external targets (outgoing) fan out to the right — a caller/callee
// split reads immediately as "what calls this / what this calls" instead
// of a generic scattered grid, which matters more here than at file
// level since this view exists specifically to answer that question.
function symbolGraphToFlow(graph: SymbolGraphResponse): { nodes: Node[]; edges: Edge[] } {
  const callerIds = new Set(graph.edges.filter((e) => e.target === graph.root).map((e) => e.source));
  const calleeIds = new Set(graph.edges.filter((e) => e.source === graph.root).map((e) => e.target));

  const callers = graph.nodes.filter((n) => callerIds.has(n.id));
  const callees = graph.nodes.filter((n) => calleeIds.has(n.id));
  const root = graph.nodes.find((n) => n.id === graph.root)!;

  const colX = 260;
  const rowH = 90;
  const centerY = (Math.max(callers.length, callees.length) * rowH) / 2;

  const nodes: Node[] = [
    { id: root.id, type: "symbol", position: { x: colX, y: centerY }, data: { ...root, isRoot: true } },
    ...callers.map((n, i) => ({
      id: n.id,
      type: "symbol",
      position: { x: 0, y: i * rowH + (centerY - ((callers.length - 1) * rowH) / 2) },
      data: { ...n, isRoot: false },
    })),
    ...callees.map((n, i) => ({
      id: n.id,
      type: "symbol",
      position: { x: colX * 2, y: i * rowH + (centerY - ((callees.length - 1) * rowH) / 2) },
      data: { ...n, isRoot: false },
    })),
  ];

  const edges: Edge[] = graph.edges.map((e) => ({
    id: `${e.source}-${e.target}-${e.type}`,
    source: e.source,
    target: e.target,
    style: { stroke: e.type === "IMPORTS" ? "var(--mute)" : "var(--color-success)", strokeWidth: 1.5 },
  }));
  return { nodes, edges };
}

// ---------- Page ----------

function GraphLegend() {
  return (
    <div className="absolute bottom-sm left-sm bg-canvas-soft border border-hairline rounded-md px-sm py-xs flex items-center gap-md text-[12px] text-mute">
      <span className="flex items-center gap-xxs">
        <span className="w-3 h-[2px] bg-success inline-block rounded-full" />
        Calls
      </span>
      <span className="flex items-center gap-xxs">
        <span className="w-3 h-[2px] bg-mute inline-block rounded-full" />
        Imports
      </span>
    </div>
  );
}

function InfoBanner({ children, onDismiss }: { children: ReactNode; onDismiss?: () => void }) {
  return (
    <div className="flex items-start gap-sm bg-canvas-soft border border-hairline rounded-md px-md py-sm text-[13px] text-body">
      <GitBranch className="w-4 h-4 text-mute shrink-0 mt-[2px]" />
      <p className="flex-1">{children}</p>
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label="Dismiss" className="text-mute hover:text-ink transition-colors shrink-0">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

export function RepositoryArchitecture() {
  const { id } = useParams();
  const [fileGraph, setFileGraph] = useState<FileGraphResponse | null>(null);
  const [symbolGraph, setSymbolGraph] = useState<SymbolGraphResponse | null>(null);
  const [popoverFile, setPopoverFile] = useState<{ path: string; topSymbols: FileGraphResponse["nodes"][number]["topSymbols"] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [drillLoading, setDrillLoading] = useState(false);
  const [error, setError] = useState("");
  const [bannerDismissed, setBannerDismissed] = useState(false);

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
  const sparseFileGraph = !showingSymbol && fileGraph.edges.length === 0;

  return (
    <div className="flex flex-col gap-sm h-full min-h-0">
      {showingSymbol ? (
        <button
          type="button"
          onClick={backToFileView}
          className="flex items-center gap-xxs text-[13px] text-mute hover:text-ink transition-colors w-fit"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Back to file view
        </button>
      ) : sparseFileGraph && !bannerDismissed ? (
        <InfoBanner onDismiss={() => setBannerDismissed(true)}>
          No cross-file relationships found — most calls in this repository likely target external code (hooks,
          DOM APIs, libraries). Click a file below to see its actual calls, including external ones.
        </InfoBanner>
      ) : !showingSymbol ? (
        <p className="text-[13px] text-mute">Click a file to see its symbols and what they call.</p>
      ) : null}

      <div className="flex-1 min-h-[400px] w-full border border-hairline rounded-md overflow-hidden relative bg-canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={showingSymbol ? symbolNodeTypes : fileNodeTypes}
          fitView
          colorMode="dark"
          proOptions={{ hideAttribution: true }}
          onNodeClick={showingSymbol ? undefined : handleFileNodeClick}
        >
          <Background gap={20} size={1} />
          <Controls position="bottom-right" showInteractive={false} />
          <MiniMap pannable zoomable className="bg-canvas-soft! border! border-hairline!" />
        </ReactFlow>
        <GraphLegend />
        {drillLoading && (
          <div className="absolute inset-0 bg-canvas/60 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-mute" />
          </div>
        )}
        {popoverFile && (
          <div className="absolute top-sm left-sm bg-canvas border border-hairline rounded-md shadow-lg p-sm w-[240px] max-w-[calc(100%-16px)]">
            <div className="flex items-center justify-between gap-xs mb-xs">
              <p className="text-[12px] font-mono text-mute truncate">{popoverFile.path}</p>
              <button
                type="button"
                onClick={() => setPopoverFile(null)}
                aria-label="Close"
                className="text-mute hover:text-ink transition-colors shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
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
          </div>
        )}
      </div>
    </div>
  );
}
