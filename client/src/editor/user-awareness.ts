/**
 * User awareness: username management and deterministic color assignment.
 *
 * - Username prompted on first visit, stored in localStorage
 * - Each username gets a deterministic color for cursor/selection display
 * - User info (name, color, colorLight) synced via Yjs awareness
 */

const USERNAME_KEY = "multiplayer-md-username";

/**
 * 8 distinguishable cursor colors for dark backgrounds.
 * Each entry: [solid, transparent] where transparent is used for selections.
 */
const CURSOR_COLORS: [string, string][] = [
  ["#f87171", "#f8717133"], // red-400
  ["#60a5fa", "#60a5fa33"], // blue-400
  ["#4ade80", "#4ade8033"], // green-400
  ["#facc15", "#facc1533"], // yellow-400
  ["#c084fc", "#c084fc33"], // purple-400
  ["#fb923c", "#fb923c33"], // orange-400
  ["#22d3ee", "#22d3ee33"], // cyan-400
  ["#f472b6", "#f472b633"], // pink-400
];

/**
 * Simple string hash (djb2) that returns a positive integer.
 */
function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/**
 * Get a deterministic color pair for a username.
 */
export function getUserColor(name: string): { color: string; colorLight: string } {
  const idx = hashString(name) % CURSOR_COLORS.length;
  const [color, colorLight] = CURSOR_COLORS[idx];
  return { color, colorLight };
}

/**
 * Get the stored username, or null if none set.
 */
export function getStoredUsername(): string | null {
  try {
    return localStorage.getItem(USERNAME_KEY);
  } catch {
    return null;
  }
}

/**
 * Store a username in localStorage.
 */
export function setStoredUsername(name: string): void {
  try {
    localStorage.setItem(USERNAME_KEY, name);
  } catch {
    // localStorage unavailable -- silently ignore
  }
}

/**
 * Generate a random anonymous name like "Anon-7f3a".
 */
export function generateAnonName(): string {
  const suffix = Math.random().toString(16).slice(2, 6);
  return `Anon-${suffix}`;
}

/**
 * Sync the local user info into Yjs awareness.
 */
export function setAwarenessUser(
  awareness: {
    getLocalState: () => Record<string, unknown> | null;
    setLocalStateField: (field: string, value: unknown) => void;
  },
  name: string,
): void {
  const { color, colorLight } = getUserColor(name);
  awareness.setLocalStateField("user", { name, color, colorLight });
}
