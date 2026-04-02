/**
 * Modal prompt for setting username on first visit.
 */

import { useState } from "react";

interface UsernamePromptProps {
  defaultValue: string;
  onSubmit: (name: string) => void;
}

export default function UsernamePrompt({ defaultValue, onSubmit }: UsernamePromptProps) {
  const [value, setValue] = useState(defaultValue);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (trimmed) {
      onSubmit(trimmed);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <form
        onSubmit={handleSubmit}
        className="bg-gray-900 border border-gray-700 rounded-lg p-6 shadow-xl w-80"
      >
        <h2 className="text-gray-100 text-sm font-semibold mb-1">
          Choose a username
        </h2>
        <p className="text-gray-400 text-xs mb-4">
          This name will be shown to other editors next to your cursor.
        </p>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={24}
          autoFocus
          placeholder="Your name"
          className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 mb-4"
        />
        <button
          type="submit"
          disabled={!value.trim()}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium rounded px-3 py-2 transition-colors"
        >
          Join
        </button>
      </form>
    </div>
  );
}
