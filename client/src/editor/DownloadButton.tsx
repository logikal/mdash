/**
 * Toolbar button: "Download"
 *
 * Serializes the current editor content to a .md file and triggers a browser
 * download. CriticMark annotations are preserved in the output so the file
 * can be re-imported later with collaboration state intact.
 */

import type { EditorView } from "@codemirror/view";

interface DownloadButtonProps {
  viewRef: React.RefObject<EditorView | null>;
  docId?: string;
}

function downloadMarkdown(view: EditorView, docId?: string): void {
  const content = view.state.doc.toString();
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const filename = docId ? `${docId}.md` : "document.md";

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();

  // Cleanup
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function DownloadButton({ viewRef, docId }: DownloadButtonProps) {
  return (
    <button
      onClick={() => {
        if (viewRef.current) downloadMarkdown(viewRef.current, docId);
      }}
      className="px-2 py-1 text-xs font-medium rounded transition-colors
        text-blue-400 hover:text-blue-300 hover:bg-blue-900/30
        border border-blue-800/50 hover:border-blue-700/50"
      title="Download as Markdown"
    >
      Download
    </button>
  );
}
