import { useNavigate, Link } from "react-router-dom";
import { useCallback, useRef, useState } from "react";

export default function HomePage() {
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createDocWithContent = useCallback(
    async (content: string) => {
      setCreating(true);
      try {
        const res = await fetch("/new", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
          redirect: "follow",
        });
        const url = new URL(res.url);
        const slug = url.pathname.slice(1);
        navigate(`/${slug}`);
      } catch (err) {
        console.error("Failed to create document:", err);
        setCreating(false);
      }
    },
    [navigate]
  );

  const handleNewDocument = useCallback(async () => {
    await createDocWithContent("");
  }, [createDocWithContent]);

  const handleFile = useCallback(
    (file: File) => {
      if (!file.name.endsWith(".md") && file.type !== "text/markdown" && file.type !== "text/plain") {
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const text = reader.result as string;
        createDocWithContent(text);
      };
      reader.readAsText(file);
    },
    [createDocWithContent]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const curlCommand = `curl ${window.location.origin}/new -T file.md`;

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(curlCommand).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [curlCommand]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-10 px-4">
      {/* Title */}
      <div className="text-center space-y-3">
        <h2 className="text-3xl font-bold text-gray-200 font-mono tracking-tight">
          Multiplayer Markdown
        </h2>
        <p className="text-gray-500 text-sm font-mono">
          Real-time collaborative editing
        </p>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleNewDocument}
          disabled={creating}
          className="px-8 py-3 bg-gray-800 hover:bg-gray-700 disabled:bg-gray-900 disabled:cursor-wait text-gray-200 border border-gray-700 hover:border-gray-600 rounded font-mono text-sm transition-colors"
        >
          {creating ? "Creating..." : "+ New Document"}
        </button>
        <Link
          to="/docs"
          className="px-8 py-3 border border-gray-700 hover:border-gray-600 text-gray-400 hover:text-gray-200 rounded font-mono text-sm transition-colors"
        >
          Browse Documents
        </Link>
      </div>

      {/* Drag-and-drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={`
          w-full max-w-md py-10 px-6
          border-2 border-dashed rounded-lg
          flex flex-col items-center justify-center gap-3
          cursor-pointer transition-colors font-mono text-sm
          ${
            dragOver
              ? "border-blue-500 bg-blue-500/5 text-blue-400"
              : "border-gray-700 hover:border-gray-600 text-gray-500 hover:text-gray-400"
          }
        `}
      >
        <svg
          className="w-8 h-8 opacity-50"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
          />
        </svg>
        <span>Drop a .md file here to import</span>
        <span className="text-xs opacity-60">or click to browse</span>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".md,text/markdown,text/plain"
        className="hidden"
        onChange={handleFileInput}
      />

      {/* CLI upload command */}
      <div className="w-full max-w-md space-y-2">
        <p className="text-xs text-gray-600 font-mono text-center">
          Or upload from the command line:
        </p>
        <div className="flex items-center gap-2 bg-gray-900 border border-gray-800 rounded px-4 py-3 font-mono text-xs text-gray-400">
          <code className="flex-1 overflow-x-auto whitespace-nowrap select-all">
            {curlCommand}
          </code>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleCopy();
            }}
            className="shrink-0 px-2 py-1 text-gray-500 hover:text-gray-300 border border-gray-700 hover:border-gray-600 rounded text-xs transition-colors"
            title="Copy to clipboard"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>
    </div>
  );
}
