import { MessageSquare, Plus, Trash2, Clock } from 'lucide-react';
import type { ChatHistoryItem } from '../../services/chatService';

interface ChatHistoryProps {
  chats: ChatHistoryItem[];
  currentChatId: string | null;
  onSelectChat: (id: string) => void;
  onNewChat: () => void;
  onDeleteChat: (id: string) => void;
}

export default function ChatHistory({
  chats,
  currentChatId,
  onSelectChat,
  onNewChat,
  onDeleteChat,
}: ChatHistoryProps) {
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="flex flex-col h-full">
      {/* New chat button */}
      <button
        onClick={onNewChat}
        className="flex items-center gap-2 px-4 py-3 mb-4 glass-card rounded-xl hover:border-cyan/30 transition-colors group"
      >
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan/20 to-purple/20 flex items-center justify-center group-hover:from-cyan/30 group-hover:to-purple/30 transition-colors">
          <Plus size={16} className="text-cyan" />
        </div>
        <span className="text-sm text-slate-300 group-hover:text-white transition-colors">
          New Chat
        </span>
      </button>

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto space-y-1">
        {chats.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-sm">
            <MessageSquare size={24} className="mx-auto mb-2 opacity-50" />
            <p>No conversations yet</p>
          </div>
        ) : (
          chats.map((chat) => (
            <div
              key={chat.id}
              className={`group relative flex items-start gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
                currentChatId === chat.id
                  ? 'bg-cyan/10 border border-cyan/20'
                  : 'hover:bg-white/5'
              }`}
              onClick={() => onSelectChat(chat.id)}
            >
              <MessageSquare
                size={14}
                className={`mt-1 flex-shrink-0 ${
                  currentChatId === chat.id ? 'text-cyan' : 'text-slate-500'
                }`}
              />
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm truncate ${
                    currentChatId === chat.id ? 'text-white' : 'text-slate-400'
                  }`}
                >
                  {chat.title || 'New conversation'}
                </p>
                <div className="flex items-center gap-1 mt-0.5">
                  <Clock size={10} className="text-slate-600" />
                  <span className="text-xs text-slate-600">
                    {formatDate(chat.updatedAt)}
                  </span>
                </div>
              </div>

              {/* Delete button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteChat(chat.id);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-coral/20 text-slate-500 hover:text-coral transition-all"
                title="Delete chat"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
