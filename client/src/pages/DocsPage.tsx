import { useEffect, useState, useMemo, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { DocumentSummary } from "@multiplayer-markdown/shared";

type FilterMode = "mine" | "all";

function getUsername(): string {
  return localStorage.getItem("username") ?? "";
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

export default function DocsPage() {
  const navigate = useNavigate();
  const [docs, setDocs] = useState<DocumentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterMode>("mine");

  const username = useMemo(() => getUsername(), []);

  useEffect(() => {
    let cancelled = false;

    async function fetchDocs() {
      try {
        const res = await fetch("/api/docs");
        if (!res.ok) {
          setError(`Failed to load documents (${res.status})`);
          return;
        }
        const body = (await res.json()) as { docs: DocumentSummary[] };
        if (!cancelled) {
          setDocs(body.docs);
        }
      } catch {
        if (!cancelled) {
          setError("Failed to load documents");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchDocs();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredDocs = useMemo(() => {
    if (filter === "all" || !username) return docs;
    return docs.filter((d) => d.owner === username);
  }, [docs, filter, username]);

  const handleToggleFilter = useCallback(() => {
    setFilter((prev) => (prev === "mine" ? "all" : "mine"));
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500 font-mono text-sm">
        Loading documents...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-gray-400 font-mono text-sm">
        <p>{error}</p>
        <Link to="/" className="text-blue-400 hover:text-blue-300 underline">
          Back to home
        </Link>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-200 font-mono">
            Documents
          </h2>
          <div className="flex items-center gap-3">
            <button
              onClick={handleToggleFilter}
              className="px-3 py-1.5 text-xs font-mono border rounded transition-colors border-gray-700 hover:border-gray-600 text-gray-400 hover:text-gray-300"
            >
              {filter === "mine" ? "Show all" : "Show mine"}
            </button>
            <button
              onClick={() => navigate("/")}
              className="px-3 py-1.5 text-xs font-mono bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-600 text-gray-200 rounded transition-colors"
            >
              + New
            </button>
          </div>
        </div>

        {/* Filter indicator */}
        {username && (
          <p className="text-xs text-gray-600 font-mono">
            {filter === "mine"
              ? `Showing documents owned by "${username}"`
              : "Showing all documents"}
          </p>
        )}

        {/* Document list */}
        {filteredDocs.length === 0 ? (
          <div className="text-center py-16 text-gray-600 font-mono text-sm space-y-3">
            <p>No documents found.</p>
            {filter === "mine" && docs.length > 0 && (
              <button
                onClick={() => setFilter("all")}
                className="text-blue-400 hover:text-blue-300 underline text-xs"
              >
                Show all documents
              </button>
            )}
          </div>
        ) : (
          <div className="border border-gray-800 rounded-lg divide-y divide-gray-800">
            {filteredDocs.map((doc) => (
              <Link
                key={doc.slug}
                to={`/${doc.slug}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-900/50 transition-colors group"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-200 font-mono truncate group-hover:text-white transition-colors">
                    {doc.title}
                  </p>
                  <p className="text-xs text-gray-600 font-mono mt-0.5">
                    {doc.owner}
                  </p>
                </div>
                <div className="shrink-0 text-right ml-4">
                  <p className="text-xs text-gray-600 font-mono">
                    {formatDate(doc.lastModified)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
