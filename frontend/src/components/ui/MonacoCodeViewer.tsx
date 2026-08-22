import Editor, { type OnMount } from "@monaco-editor/react";

export interface MonacoCodeViewerProps {
  line: number;
  content: string;
  language: string;
}

// Single-pane read-only code viewer for a chat citation. Unlike
// MonacoDiffViewer (PR review), a citation points at a chunk's *current*
// indexed content — there's no before/after commit to diff — so this
// wraps @monaco-editor/react's plain Editor, not DiffEditor.
export function MonacoCodeViewer({ line, content, language }: MonacoCodeViewerProps) {
  const handleMount: OnMount = (editor) => {
    const model = editor.getModel();
    const lineCount = model?.getLineCount() ?? 1;
    // `line` comes from the citation's startLine, already validated
    // server-side against the retrieved chunk (citation-validator.service.ts)
    // — still clamp defensively rather than trust it unconditionally.
    const safeLine = Math.min(Math.max(line, 1), lineCount);
    editor.revealLineInCenter(safeLine);
  };

  return (
    <div className="rounded-sm border border-hairline overflow-hidden">
      <Editor
        height="240px"
        language={language}
        value={content}
        theme="vs-dark"
        options={{ readOnly: true, minimap: { enabled: false }, fontSize: 13 }}
        onMount={handleMount}
      />
    </div>
  );
}
