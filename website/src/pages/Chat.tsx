import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare, Menu, X, Sparkles, LogIn } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import ChatMessage from '../components/chat/ChatMessage';
import ChatInput from '../components/chat/ChatInput';
import ChatHistory from '../components/chat/ChatHistory';
import ModelSelector from '../components/chat/ModelSelector';
import UsageIndicator from '../components/chat/UsageIndicator';
import {
  streamChatCompletion,
  loadChatHistory,
  saveChatHistory,
  setCurrentChatId,
  getCurrentChatId,
  generateId,
  MODEL_CATEGORIES,
  type ChatMessage as ChatMessageType,
  type ChatHistoryItem,
  type RateLimitInfo,
} from '../services/chatService';

// Default to the free model
const DEFAULT_MODEL = MODEL_CATEGORIES[0]?.models[0]?.id || 'meta-llama/llama-3.2-3b-instruct:free';

const RATE_LIMITS = { anonymous: 5, free: 25, pro: 300, team: 1000 };

export default function Chat() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chats, setChats] = useState<ChatHistoryItem[]>([]);
  const [currentChatId, setCurrentChatIdState] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL);
  const [rateLimitError, setRateLimitError] = useState<(RateLimitInfo & { message: string }) | null>(null);
  const [usage, setUsage] = useState({ used: 0, limit: 5 });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Determine user plan
  const plan = user?.subscription?.plan || 'anonymous';
  const isPro = plan === 'pro' || plan === 'team';
  const limit = RATE_LIMITS[plan as keyof typeof RATE_LIMITS] || 5;

  // Load chat history on mount
  useEffect(() => {
    const history = loadChatHistory();
    setChats(history);

    const savedChatId = getCurrentChatId();
    if (savedChatId) {
      const chat = history.find((c) => c.id === savedChatId);
      if (chat) {
        setCurrentChatIdState(savedChatId);
        setMessages(chat.messages);
        setSelectedModel(chat.model);
      }
    }
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Update usage based on plan
  useEffect(() => {
    setUsage((prev) => ({ ...prev, limit }));
  }, [limit]);

  const startNewChat = useCallback(() => {
    const newId = generateId();
    setCurrentChatIdState(newId);
    setCurrentChatId(newId);
    setMessages([]);
    setRateLimitError(null);
    setSidebarOpen(false);
  }, []);

  const selectChat = useCallback((id: string) => {
    const chat = chats.find((c) => c.id === id);
    if (chat) {
      setCurrentChatIdState(id);
      setCurrentChatId(id);
      setMessages(chat.messages);
      setSelectedModel(chat.model);
      setRateLimitError(null);
      setSidebarOpen(false);
    }
  }, [chats]);

  const deleteChat = useCallback((id: string) => {
    const updated = chats.filter((c) => c.id !== id);
    setChats(updated);
    saveChatHistory(updated);

    if (currentChatId === id) {
      startNewChat();
    }
  }, [chats, currentChatId, startNewChat]);

  const saveCurrentChat = useCallback((updatedMessages: ChatMessageType[]) => {
    if (!currentChatId || updatedMessages.length === 0) return;

    const title = updatedMessages.find((m) => m.role === 'user')?.content.slice(0, 100) || 'New chat';
    const now = Date.now();

    const existingChat = chats.find((c) => c.id === currentChatId);
    const updatedChat: ChatHistoryItem = {
      id: currentChatId,
      title,
      messages: updatedMessages,
      model: selectedModel,
      createdAt: existingChat?.createdAt || now,
      updatedAt: now,
    };

    const updatedChats = [
      updatedChat,
      ...chats.filter((c) => c.id !== currentChatId),
    ].slice(0, 50);

    setChats(updatedChats);
    saveChatHistory(updatedChats);
  }, [currentChatId, chats, selectedModel]);

  const handleSend = async (content: string) => {
    if (isStreaming) return;

    // Ensure we have a chat ID
    let chatId = currentChatId;
    if (!chatId) {
      chatId = generateId();
      setCurrentChatIdState(chatId);
      setCurrentChatId(chatId);
    }

    // Add user message
    const userMessage: ChatMessageType = {
      id: generateId(),
      role: 'user',
      content,
      timestamp: Date.now(),
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setRateLimitError(null);

    // Add placeholder for assistant message
    const assistantMessage: ChatMessageType = {
      id: generateId(),
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    };

    setMessages([...updatedMessages, assistantMessage]);
    setIsStreaming(true);

    abortControllerRef.current = new AbortController();

    await streamChatCompletion(
      updatedMessages.map((m) => ({ role: m.role, content: m.content })),
      { model: selectedModel },
      {
        onChunk: (_, fullContent) => {
          setMessages((prev) => {
            const updated = [...prev];
            const lastMsg = updated[updated.length - 1];
            if (lastMsg.role === 'assistant') {
              lastMsg.content = fullContent;
            }
            return updated;
          });
        },
        onComplete: (fullContent) => {
          setMessages((prev) => {
            const updated = [...prev];
            const lastMsg = updated[updated.length - 1];
            if (lastMsg.role === 'assistant') {
              lastMsg.content = fullContent;
            }
            saveCurrentChat(updated);
            return updated;
          });
          setIsStreaming(false);
          setUsage((prev) => ({ ...prev, used: prev.used + 1 }));
        },
        onError: (error) => {
          setMessages((prev) => {
            const updated = [...prev];
            const lastMsg = updated[updated.length - 1];
            if (lastMsg.role === 'assistant') {
              lastMsg.content = `Error: ${error}`;
            }
            return updated;
          });
          setIsStreaming(false);
        },
        onRateLimit: (info) => {
          setRateLimitError(info);
          setMessages((prev) => prev.slice(0, -1)); // Remove empty assistant message
          setIsStreaming(false);
        },
      }
    );
  };

  const handleStop = () => {
    abortControllerRef.current?.abort();
    setIsStreaming(false);
  };

  return (
    <div className="relative min-h-screen pt-20">
      {/* Background */}
      <div className="mesh-gradient" />
      <div className="orb orb-cyan w-80 h-80 -top-40 -left-40 animate-pulse-glow" />
      <div className="orb orb-purple w-64 h-64 bottom-1/4 -right-32 animate-pulse-glow delay-300" />

      <div className="relative flex h-[calc(100vh-5rem)]">
        {/* Mobile sidebar toggle */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="lg:hidden fixed top-24 left-4 z-50 p-2 glass-card rounded-lg"
        >
          {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        {/* Sidebar */}
        <aside
          className={`fixed lg:relative inset-y-0 left-0 z-40 w-72 glass-card border-r border-white/5 transform transition-transform lg:transform-none ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          }`}
          style={{ top: '5rem' }}
        >
          <div className="flex flex-col h-full p-4">
            {/* Header */}
            <div className="flex items-center gap-2 mb-6">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan/20 to-purple/20 flex items-center justify-center">
                <MessageSquare size={16} className="text-cyan" />
              </div>
              <span className="font-semibold text-white">AI Chat</span>
            </div>

            {/* Usage */}
            <div className="mb-4">
              <UsageIndicator
                used={usage.used}
                limit={usage.limit}
                plan={plan as any}
                isAuthenticated={!!user}
              />
            </div>

            {/* Chat History */}
            <div className="flex-1 overflow-hidden">
              <ChatHistory
                chats={chats}
                currentChatId={currentChatId}
                onSelectChat={selectChat}
                onNewChat={startNewChat}
                onDeleteChat={deleteChat}
              />
            </div>

            {/* Sign in prompt */}
            {!user && (
              <div className="mt-4 p-3 rounded-xl bg-purple/10 border border-purple/20">
                <div className="flex items-center gap-2 mb-2">
                  <LogIn size={14} className="text-purple" />
                  <span className="text-sm font-medium text-purple">Sign in</span>
                </div>
                <p className="text-xs text-slate-400 mb-2">
                  Get 25 messages/day and sync your chats
                </p>
                <Link
                  to="/"
                  className="block text-center text-xs text-cyan hover:underline"
                >
                  Sign in or create account
                </Link>
              </div>
            )}
          </div>
        </aside>

        {/* Main chat area */}
        <main className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <header className="flex items-center justify-between px-6 py-4 border-b border-white/5">
            <div className="flex items-center gap-4 pl-10 lg:pl-0">
              <ModelSelector
                selectedModel={selectedModel}
                onSelectModel={setSelectedModel}
                isPro={isPro}
              />
            </div>
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-cyan" />
              <span className="text-sm text-slate-400">
                {messages.length} messages
              </span>
            </div>
          </header>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan/20 to-purple/20 flex items-center justify-center mb-4">
                  <MessageSquare size={32} className="text-cyan" />
                </div>
                <h2 className="text-xl font-semibold text-white mb-2">
                  Start a conversation
                </h2>
                <p className="text-slate-400 max-w-md">
                  Ask me anything! I can help with coding, writing, research, and more.
                  {!user && ' Sign in for more messages and chat sync.'}
                </p>
              </div>
            ) : (
              messages.map((msg, idx) => (
                <ChatMessage
                  key={msg.id}
                  message={msg}
                  isStreaming={isStreaming && idx === messages.length - 1 && msg.role === 'assistant'}
                />
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Rate limit error */}
          {rateLimitError && (
            <div className="mx-6 mb-4 p-4 rounded-xl bg-coral/10 border border-coral/20">
              <p className="text-sm text-coral mb-2">{rateLimitError.message}</p>
              <Link
                to="/pricing"
                className="inline-flex items-center gap-1 text-sm text-cyan hover:underline"
              >
                Upgrade to Pro
              </Link>
            </div>
          )}

          {/* Input */}
          <div className="p-6 border-t border-white/5">
            <ChatInput
              onSend={handleSend}
              onStop={handleStop}
              isStreaming={isStreaming}
              disabled={!!rateLimitError}
              placeholder={
                rateLimitError
                  ? 'Daily limit reached. Upgrade for more messages.'
                  : 'Type your message...'
              }
            />
          </div>
        </main>
      </div>
    </div>
  );
}
