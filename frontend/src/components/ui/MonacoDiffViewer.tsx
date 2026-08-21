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
    modifiedEditor.revealLineInCenter(line);
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
