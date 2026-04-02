import { useNavigate } from "react-router-dom";
import { useCallback, useState } from "react";

export default function HomePage() {
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);

  const handleNewDocument = useCallback(async () => {
    setCreating(true);
    try {
      const res = await fetch("/new", { method: "POST", redirect: "follow" });
      // The server redirects to /:docId — we follow the redirect
      // and extract the slug from the final URL
      const url = new URL(res.url);
      const slug = url.pathname.slice(1); // strip leading /
      navigate(`/${slug}`);
    } catch (err) {
      console.error("Failed to create document:", err);
      setCreating(false);
    }
  }, [navigate]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-8 px-4">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-gray-200">Multiplayer Markdown</h2>
        <p className="text-gray-500 text-sm">
          A real-time collaborative markdown editor
        </p>
      </div>
      <button
        onClick={handleNewDocument}
        disabled={creating}
        className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-wait text-white rounded-lg font-medium transition-colors"
      >
        {creating ? "Creating..." : "New Document"}
      </button>
    </div>
  );
}
