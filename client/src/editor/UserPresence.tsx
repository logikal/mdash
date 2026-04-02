/**
 * User presence display: shows colored dots for connected users,
 * plus an edit button for changing your own username.
 */

import { getUserColor } from "./user-awareness";

interface UserInfo {
  name: string;
  color: string;
}

interface UserPresenceProps {
  username: string;
  remoteUsers: UserInfo[];
  onEditUsername: () => void;
}

export default function UserPresence({ username, remoteUsers, onEditUsername }: UserPresenceProps) {
  const myColor = getUserColor(username).color;

  return (
    <div className="flex items-center gap-2">
      {/* Remote user avatars */}
      <div className="flex items-center -space-x-1">
        {remoteUsers.map((user, i) => (
          <div
            key={`${user.name}-${i}`}
            title={user.name}
            className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-gray-950 border border-gray-800 shrink-0"
            style={{ backgroundColor: user.color }}
          >
            {user.name.charAt(0).toUpperCase()}
          </div>
        ))}
      </div>

      {/* Local user chip (clickable to edit) */}
      <button
        onClick={onEditUsername}
        className="flex items-center gap-1.5 text-xs text-gray-300 hover:text-gray-100 transition-colors"
        title="Click to change your name"
      >
        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: myColor }} />
        <span className="max-w-[100px] truncate">{username}</span>
      </button>
    </div>
  );
}
