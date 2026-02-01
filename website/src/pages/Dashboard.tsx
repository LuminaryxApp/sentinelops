import { useState, useEffect } from 'react';
import { Navigate, Link } from 'react-router-dom';
import {
  LayoutDashboard, MessageSquare, Brain, Settings, BarChart3,
  Zap, Trash2, Search, Pin, ExternalLink,
  ArrowRight, Loader2, RefreshCw
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

type Tab = 'overview' | 'chats' | 'memories' | 'settings';

interface CloudChat {
  id: string;
  title: string;
  model: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

interface CloudMemory {
  id: string;
  content: string;
  summary: string | null;
  type: string;
  tags: string[];
  importance: number;
  isPinned: boolean;
  createdAt: string;
}

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [chats, setChats] = useState<CloudChat[]>([]);
  const [memories, setMemories] = useState<CloudMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Redirect if not authenticated
  if (!authLoading && !user) {
    return <Navigate to="/" replace />;
  }

  // Simulated data loading - in real implementation, this would fetch from API
  useEffect(() => {
    if (user) {
      // Simulate loading data
      setTimeout(() => {
        setChats([]);
        setMemories([]);
        setLoading(false);
      }, 500);
    }
  }, [user]);

  const tabs = [
    { id: 'overview' as Tab, label: 'Overview', icon: BarChart3 },
    { id: 'chats' as Tab, label: 'Chats', icon: MessageSquare },
    { id: 'memories' as Tab, label: 'Memories', icon: Brain },
    { id: 'settings' as Tab, label: 'Settings', icon: Settings },
  ];

  const plan = user?.subscription?.plan || 'free';
  const isPro = plan === 'pro' || plan === 'team';

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (authLoading) {
    return (
      <div className="relative min-h-screen pt-32 pb-24 px-6">
        <div className="mesh-gradient" />
        <div className="max-w-6xl mx-auto text-center">
          <Loader2 size={32} className="mx-auto animate-spin text-cyan" />
          <p className="mt-4 text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen pt-28 pb-24 px-6">
      {/* Background */}
      <div className="mesh-gradient" />
      <div className="orb orb-purple w-80 h-80 -top-40 -right-40 animate-pulse-glow" />
      <div className="orb orb-cyan w-64 h-64 bottom-1/4 -left-32 animate-pulse-glow delay-300" />

      <div className="max-w-6xl mx-auto relative">
        {/* Header */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-subtle mb-4">
            <LayoutDashboard size={14} className="text-cyan" />
            <span className="text-sm text-slate-300">Dashboard</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-2">
            Welcome back, <span className="gradient-text">{user?.name}</span>
          </h1>
          <p className="text-slate-400">
            View your synced data from the SentinelOps desktop app
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap gap-2 mb-8">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-cyan/10 text-cyan border border-cyan/20'
                    : 'glass-card text-slate-400 hover:text-white'
                }`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <>
              {/* Stats Grid */}
              <div className="grid md:grid-cols-4 gap-4">
                <div className="glass-card rounded-2xl p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-cyan/20 flex items-center justify-center">
                      <MessageSquare size={20} className="text-cyan" />
                    </div>
                    <span className="text-sm text-slate-400">Total Chats</span>
                  </div>
                  <div className="text-3xl font-bold text-white">{chats.length}</div>
                </div>

                <div className="glass-card rounded-2xl p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-purple/20 flex items-center justify-center">
                      <Brain size={20} className="text-purple" />
                    </div>
                    <span className="text-sm text-slate-400">Memories</span>
                  </div>
                  <div className="text-3xl font-bold text-white">{memories.length}</div>
                </div>

                <div className="glass-card rounded-2xl p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-coral/20 flex items-center justify-center">
                      <Zap size={20} className="text-coral" />
                    </div>
                    <span className="text-sm text-slate-400">Plan</span>
                  </div>
                  <div className="text-3xl font-bold text-white capitalize">{plan}</div>
                </div>

                <div className="glass-card rounded-2xl p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                      <RefreshCw size={20} className="text-green-400" />
                    </div>
                    <span className="text-sm text-slate-400">Sync Status</span>
                  </div>
                  <div className="text-lg font-bold text-green-400">Connected</div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="glass-card rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
                <div className="grid md:grid-cols-3 gap-4">
                  <Link
                    to="/chat"
                    className="flex items-center justify-between p-4 rounded-xl bg-midnight-100 hover:bg-midnight-200 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <MessageSquare size={20} className="text-cyan" />
                      <span className="text-sm text-slate-300">Start New Chat</span>
                    </div>
                    <ArrowRight size={16} className="text-slate-500 group-hover:text-cyan transition-colors" />
                  </Link>

                  <Link
                    to="/pricing"
                    className="flex items-center justify-between p-4 rounded-xl bg-midnight-100 hover:bg-midnight-200 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <Zap size={20} className="text-purple" />
                      <span className="text-sm text-slate-300">
                        {isPro ? 'Manage Subscription' : 'Upgrade to Pro'}
                      </span>
                    </div>
                    <ArrowRight size={16} className="text-slate-500 group-hover:text-purple transition-colors" />
                  </Link>

                  <a
                    href="https://github.com/LuminaryxApp/sentinelops/releases/latest"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-4 rounded-xl bg-midnight-100 hover:bg-midnight-200 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <ExternalLink size={20} className="text-coral" />
                      <span className="text-sm text-slate-300">Download Desktop App</span>
                    </div>
                    <ArrowRight size={16} className="text-slate-500 group-hover:text-coral transition-colors" />
                  </a>
                </div>
              </div>

              {/* Sync Info */}
              {!isPro && (
                <div className="glass-card rounded-2xl p-6 border border-purple/20 bg-purple/5">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-purple/20 flex items-center justify-center flex-shrink-0">
                      <RefreshCw size={24} className="text-purple" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-2">
                        Enable Cloud Sync
                      </h3>
                      <p className="text-slate-400 text-sm mb-4">
                        Upgrade to Pro to sync your chat history, memories, and settings across all your devices.
                        Your data will automatically sync between the desktop app and web.
                      </p>
                      <Link
                        to="/pricing"
                        className="inline-flex items-center gap-2 text-sm text-purple hover:text-white transition-colors"
                      >
                        Upgrade to Pro
                        <ArrowRight size={14} />
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Chats Tab */}
          {activeTab === 'chats' && (
            <div className="glass-card rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white">Synced Conversations</h3>
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search chats..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-4 py-2 bg-midnight-100 border border-white/5 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan/30"
                  />
                </div>
              </div>

              {loading ? (
                <div className="text-center py-12">
                  <Loader2 size={24} className="mx-auto animate-spin text-cyan" />
                </div>
              ) : chats.length === 0 ? (
                <div className="text-center py-12">
                  <MessageSquare size={48} className="mx-auto text-slate-600 mb-4" />
                  <h4 className="text-lg font-medium text-white mb-2">No synced chats yet</h4>
                  <p className="text-slate-400 text-sm mb-4">
                    {isPro
                      ? 'Your conversations from the desktop app will appear here once synced.'
                      : 'Upgrade to Pro to sync your chat history.'}
                  </p>
                  <Link to="/chat" className="btn-primary inline-flex items-center gap-2 text-sm">
                    <MessageSquare size={16} />
                    Start a conversation
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {chats
                    .filter((c) =>
                      c.title.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .map((chat) => (
                      <div
                        key={chat.id}
                        className="flex items-center justify-between p-4 rounded-xl bg-midnight-100 hover:bg-midnight-200 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <MessageSquare size={18} className="text-cyan" />
                          <div>
                            <div className="text-sm font-medium text-white">{chat.title}</div>
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                              <span>{chat.model}</span>
                              <span>•</span>
                              <span>{chat.messageCount} messages</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-slate-500">
                            {formatDate(chat.updatedAt)}
                          </span>
                          <button className="p-1.5 rounded-lg hover:bg-coral/20 text-slate-500 hover:text-coral transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* Memories Tab */}
          {activeTab === 'memories' && (
            <div className="glass-card rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white">AI Memories</h3>
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search memories..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-4 py-2 bg-midnight-100 border border-white/5 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan/30"
                  />
                </div>
              </div>

              {loading ? (
                <div className="text-center py-12">
                  <Loader2 size={24} className="mx-auto animate-spin text-cyan" />
                </div>
              ) : memories.length === 0 ? (
                <div className="text-center py-12">
                  <Brain size={48} className="mx-auto text-slate-600 mb-4" />
                  <h4 className="text-lg font-medium text-white mb-2">No memories synced</h4>
                  <p className="text-slate-400 text-sm">
                    {isPro
                      ? 'Memories from the desktop app will appear here once synced.'
                      : 'Upgrade to Pro to sync your AI memories across devices.'}
                  </p>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {memories
                    .filter((m) =>
                      m.content.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .map((memory) => (
                      <div
                        key={memory.id}
                        className="p-4 rounded-xl bg-midnight-100 hover:bg-midnight-200 transition-colors"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {memory.isPinned && (
                              <Pin size={12} className="text-cyan" />
                            )}
                            <span className="text-xs px-2 py-0.5 rounded-full bg-purple/20 text-purple capitalize">
                              {memory.type}
                            </span>
                          </div>
                          <span className="text-xs text-slate-500">
                            {formatDate(memory.createdAt)}
                          </span>
                        </div>
                        <p className="text-sm text-slate-300 line-clamp-3">
                          {memory.summary || memory.content}
                        </p>
                        {memory.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {memory.tags.map((tag) => (
                              <span
                                key={tag}
                                className="text-xs px-2 py-0.5 rounded-full bg-midnight-200 text-slate-400"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div className="space-y-6">
              {/* Account */}
              <div className="glass-card rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Account</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between py-3 border-b border-white/5">
                    <div>
                      <div className="text-sm text-white">Email</div>
                      <div className="text-sm text-slate-500">{user?.email}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between py-3 border-b border-white/5">
                    <div>
                      <div className="text-sm text-white">Name</div>
                      <div className="text-sm text-slate-500">{user?.name}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <div>
                      <div className="text-sm text-white">Plan</div>
                      <div className="text-sm text-slate-500 capitalize">{plan}</div>
                    </div>
                    {!isPro && (
                      <Link
                        to="/pricing"
                        className="text-sm text-cyan hover:underline"
                      >
                        Upgrade
                      </Link>
                    )}
                  </div>
                </div>
              </div>

              {/* Synced Settings */}
              <div className="glass-card rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Synced Settings</h3>
                {isPro ? (
                  <p className="text-slate-400 text-sm">
                    Your settings are synced from the desktop app. Changes made in the app will appear here.
                  </p>
                ) : (
                  <div className="text-center py-8">
                    <Settings size={32} className="mx-auto text-slate-600 mb-3" />
                    <p className="text-slate-400 text-sm mb-4">
                      Upgrade to Pro to sync settings across devices
                    </p>
                    <Link
                      to="/pricing"
                      className="inline-flex items-center gap-2 text-sm text-cyan hover:underline"
                    >
                      View plans
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                )}
              </div>

              {/* Danger Zone */}
              <div className="glass-card rounded-2xl p-6 border border-coral/20">
                <h3 className="text-lg font-semibold text-coral mb-4">Danger Zone</h3>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-white">Delete all synced data</div>
                    <div className="text-xs text-slate-500">
                      This will remove all your synced chats and memories from the cloud
                    </div>
                  </div>
                  <button className="px-4 py-2 text-sm text-coral border border-coral/30 rounded-lg hover:bg-coral/10 transition-colors">
                    Delete Data
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
