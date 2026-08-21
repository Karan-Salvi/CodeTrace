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
        options={{ readOnly: true, renderSideBySide: true, minimap: { enabled: false }, fontSize: 13 }}
        onMount={handleMount}
      />
    </div>
  );
}
