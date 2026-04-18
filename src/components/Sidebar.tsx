import { Plus, MessageSquare } from "lucide-react";
import { ChatSession } from "../types";

interface Props {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onNewChat: () => void;
  onSelectSession: (id: string) => void;
}

export default function Sidebar({ sessions, activeSessionId, onNewChat, onSelectSession }: Props) {
  return (
    <div className="w-60 flex-shrink-0 flex flex-col bg-bg-sidebar border-r border-border h-full">
      {/* Header */}
      <div className="px-4 pt-5 pb-3">
        <h1 className="text-lg font-bold text-text-primary tracking-tight">Vertical</h1>
        <p className="text-xs text-text-muted mt-0.5">CLI Chat Interface</p>
      </div>

      <div className="px-3 pb-3 border-b border-border">
        <button
          onClick={onNewChat}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
        >
          <Plus size={15} />
          New Chat
        </button>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
        {sessions.length === 0 && (
          <p className="text-xs text-text-muted text-center py-4">No chats yet</p>
        )}
        {[...sessions].reverse().map((sess) => (
          <button
            key={sess.id}
            onClick={() => onSelectSession(sess.id)}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-colors ${
              sess.id === activeSessionId
                ? "bg-blue-600/20 text-blue-400"
                : "text-text-muted hover:text-text-primary hover:bg-surface"
            }`}
          >
            <MessageSquare size={13} className="flex-shrink-0" />
            <span className="truncate flex-1">{sess.title}</span>
            {sess.isStreaming && (
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0 animate-pulse" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
