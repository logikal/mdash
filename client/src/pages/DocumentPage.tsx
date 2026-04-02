import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import Editor from "../editor/Editor";
import type { Document } from "@mdash/shared";

export default function DocumentPage() {
  const { docId } = useParams<{ docId: string }>();
  const navigate = useNavigate();
  const [doc, setDoc] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!docId) return;

    let cancelled = false;

    async function loadDoc() {
      try {
        const res = await fetch(`/api/docs/${docId}`);
        if (!res.ok) {
          if (res.status === 404) {
            setError("Document not found");
          } else {
            setError(`Failed to load document (${res.status})`);
          }
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          setDoc(data);
        }
      } catch {
        if (!cancelled) {
          setError("Failed to load document");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadDoc();

    return () => {
      cancelled = true;
    };
  }, [docId]);

  if (loading) {
    return <div className="flex-1 flex items-center justify-center text-gray-500">Loading...</div>;
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-gray-400">
        <p>{error}</p>
        <button
          onClick={() => navigate("/")}
          className="text-blue-400 hover:text-blue-300 underline text-sm"
        >
          Back to home
        </button>
      </div>
    );
  }

  return <Editor initialContent={doc?.content ?? ""} docId={docId ?? ""} />;
}
