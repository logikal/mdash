import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import HomePage from "./pages/HomePage";
import DocsPage from "./pages/DocsPage";
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
            mdash
          </Link>
          <Link
            to="/docs"
            className="text-xs font-mono text-gray-500 hover:text-gray-300 transition-colors"
          >
            Browse docs
          </Link>
        </header>
        <main className="flex-1 min-h-0 flex flex-col">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/docs" element={<DocsPage />} />
            <Route path="/:docId" element={<DocumentPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
