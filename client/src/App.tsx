import Editor from "./editor/Editor";

export default function App() {
  return (
    <div className="h-screen flex flex-col bg-gray-950 text-gray-100">
      <header className="flex items-center justify-between px-4 py-2 border-b border-gray-800">
        <h1 className="text-sm font-semibold tracking-wide text-gray-400 uppercase">
          Multiplayer Markdown
        </h1>
      </header>
      <main className="flex-1 min-h-0 flex flex-col">
        <Editor />
      </main>
    </div>
  );
}
