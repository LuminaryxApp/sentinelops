import { User, Bot, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import type { ChatMessage as ChatMessageType } from '../../services/chatService';

interface ChatMessageProps {
  message: ChatMessageType;
  isStreaming?: boolean;
}

export default function ChatMessage({ message, isStreaming }: ChatMessageProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`group flex gap-4 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
          isUser
            ? 'bg-gradient-to-br from-cyan/20 to-purple/20'
            : 'bg-gradient-to-br from-purple/20 to-coral/20'
        }`}
      >
        {isUser ? (
          <User size={16} className="text-cyan" />
        ) : (
          <Bot size={16} className="text-purple" />
        )}
      </div>

      {/* Message content */}
      <div className={`flex-1 max-w-[80%] ${isUser ? 'text-right' : ''}`}>
        <div
          className={`inline-block rounded-2xl px-4 py-3 ${
            isUser
              ? 'bg-gradient-to-br from-cyan/10 to-purple/10 border border-cyan/20'
              : 'glass-card'
          }`}
        >
          <div className="text-sm text-slate-300 whitespace-pre-wrap break-words">
            {message.content}
            {isStreaming && (
              <span className="inline-block w-1.5 h-4 bg-cyan ml-0.5 animate-pulse" />
            )}
          </div>
        </div>

        {/* Actions */}
        {!isUser && message.content && !isStreaming && (
          <div className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-cyan transition-colors"
            >
              {copied ? (
                <>
                  <Check size={12} />
                  Copied
                </>
              ) : (
                <>
                  <Copy size={12} />
                  Copy
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
