import { useEffect, useState } from "react";
import { DiffEditor, type DiffOnMount } from "@monaco-editor/react";

export interface MonacoDiffViewerProps {
  line: number;
  original: string;
  modified: string;
  language: string;
}

// Read-only base/head diff viewer for a PR-review finding's file. Always
// diffs finding.file against the PR's own base/head — never a citation's
// file (a citation can legitimately point at an unchanged dependency file
// that isn't part of this PR's diff at all).
export function MonacoDiffViewer({ line, original, modified, language }: MonacoDiffViewerProps) {
  // Side-by-side splits the container in half — on a phone-width viewport
  // each pane is too narrow to read a real code line, forcing constant
  // horizontal scroll on both panes at once. Below sm, Monaco's own inline
  // (unified) diff mode reads far better than two crushed columns.
  const [sideBySide, setSideBySide] = useState(() => window.matchMedia("(min-width: 640px)").matches);

  useEffect(() => {
    const mql = window.matchMedia("(min-width: 640px)");
    const handler = (e: MediaQueryListEvent) => setSideBySide(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  const handleMount: DiffOnMount = (editor) => {
    const modifiedEditor = editor.getModifiedEditor();
    const model = modifiedEditor.getModel();
    const lineCount = model?.getLineCount() ?? 1;
    // `line` comes from the LLM-emitted finding, never bounds-checked
    // against the actual file — an off-by-one or hallucinated line
    // number would otherwise be passed straight to Monaco and can throw
    // inside this onMount callback, breaking the whole diff viewer for
    // that finding instead of just showing a slightly-off scroll position.
    const safeLine = Math.min(Math.max(line, 1), lineCount);
    modifiedEditor.revealLineInCenter(safeLine);
  };

  return (
    <div className="rounded-sm border border-hairline overflow-hidden">
      <DiffEditor
        height="320px"
        language={language}
        original={original}
        modified={modified}
        theme="vs-dark"
        options={{ readOnly: true, renderSideBySide: sideBySide, minimap: { enabled: false }, fontSize: 13 }}
        onMount={handleMount}
      />
    </div>
  );
}
