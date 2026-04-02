import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import HomePage from "./pages/HomePage";
import DocumentPage from "./pages/DocumentPage";

export default function App() {
  return (
    <BrowserRouter>
      <div className="h-screen flex flex-col bg-gray-950 text-gray-100">
        <header className="flex items-center justify-between px-4 py-2 border-b border-gray-800">
          <Link
            to="/"
            className="text-sm font-semibold tracking-wide text-gray-400 uppercase hover:text-gray-200 transition-colors"
          >
            Multiplayer Markdown
          </Link>
        </header>
        <main className="flex-1 min-h-0 flex flex-col">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/:docId" element={<DocumentPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
