import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bot, Code2, Terminal, GitBranch, Puzzle, Brain,
  Download, Sparkles, ChevronDown, Check, ArrowRight,
  Zap, Shield, Globe, Cpu, Monitor, Apple, Command
} from 'lucide-react';

const RELEASE_BASE = 'https://github.com/LuminaryxApp/sentinelops/releases/latest/download';
const VERSION = '0.1.4';

export default function Home() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const features = [
    {
      icon: Bot,
      title: 'AI Agent',
      desc: 'Chat, agent, and plan modes with 400+ cloud models or unlimited local AI via Ollama.',
      gradient: 'from-cyan to-cyan/50',
    },
    {
      icon: Code2,
      title: 'Code Editor',
      desc: 'Monaco-powered with syntax highlighting, themes, and VS Code keybindings.',
      gradient: 'from-purple to-purple/50',
    },
    {
      icon: Terminal,
      title: 'Integrated Terminal',
      desc: 'Full shell support without leaving the app. Run commands and scripts seamlessly.',
      gradient: 'from-coral to-coral/50',
    },
    {
      icon: GitBranch,
      title: 'Git Integration',
      desc: 'Complete Git workflow: status, stage, commit, diff, branches, and history.',
      gradient: 'from-cyan to-purple/50',
    },
    {
      icon: Puzzle,
      title: 'Extensions',
      desc: 'Install themes and extensions from Open VSX marketplace.',
      gradient: 'from-purple to-coral/50',
    },
    {
      icon: Brain,
      title: 'Context Memory',
      desc: 'AI remembers your preferences and project context across sessions.',
      gradient: 'from-coral to-cyan/50',
    },
  ];

  const stats = [
    { value: '400+', label: 'AI Models' },
    { value: '0ms', label: 'Local Latency' },
    { value: '100%', label: 'Open Source' },
    { value: 'Free', label: 'Forever' },
  ];

  const platforms = [
    { icon: Monitor, name: 'Windows', file: `SentinelOps_${VERSION}_x64-setup.exe` },
    { icon: Apple, name: 'macOS (Apple Silicon)', file: `SentinelOps_${VERSION}_aarch64.app.tar.gz` },
    { icon: Apple, name: 'macOS (Intel)', file: `SentinelOps_${VERSION}_x64.app.tar.gz` },
    { icon: Command, name: 'Linux', file: `SentinelOps_${VERSION}_amd64.AppImage` },
  ];

  const faqs = [
    {
      q: 'Is SentinelOps really free?',
      a: 'Yes! The core editor and local AI features are completely free. The free tier includes 25 cloud AI messages per day. Upgrade to Pro for unlimited cloud AI access.',
    },
    {
      q: 'How do local AI models work?',
      a: 'Install Ollama or LM Studio, then configure in Settings. Local models run entirely on your machine with zero latency, no API limits, and complete privacy.',
    },
    {
      q: 'What platforms are supported?',
      a: 'SentinelOps runs on Windows, macOS (Intel and Apple Silicon), and Linux. Download the installer for your platform above.',
    },
    {
      q: 'Can I use my own API keys?',
      a: 'Absolutely. Set LLM_API_KEY and LLM_BASE_URL in your .env file to use OpenRouter, OpenAI, Anthropic, or any compatible API directly.',
    },
  ];

  return (
    <div className="relative">
      {/* Animated mesh background */}
      <div className="mesh-gradient" />

      {/* Decorative orbs */}
      <div className="orb orb-cyan w-96 h-96 -top-48 -left-48 animate-pulse-glow" />
      <div className="orb orb-purple w-80 h-80 top-1/4 -right-40 animate-pulse-glow delay-300" />
      <div className="orb orb-coral w-64 h-64 bottom-1/4 -left-32 animate-pulse-glow delay-500" />

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center pt-20 pb-32 px-6">
        <div className="max-w-5xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-subtle mb-8 animate-fade-in">
            <Sparkles size={14} className="text-cyan" />
            <span className="text-sm text-slate-300">AI-Powered Development Environment</span>
          </div>

          {/* Headline */}
          <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold leading-none mb-8 animate-slide-up">
            <span className="gradient-text-subtle">Code Smarter</span>
            <br />
            <span className="gradient-text">Build Faster</span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto mb-12 animate-slide-up delay-100">
            The complete development environment with AI that understands your project.
            Use 400+ cloud models or run locally with{' '}
            <span className="text-white font-medium">zero limits</span>.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-wrap justify-center gap-4 mb-16 animate-slide-up delay-200">
            <a
              href="https://github.com/LuminaryxApp/sentinelops/releases/latest"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary flex items-center gap-2 text-lg"
            >
              <Download size={20} />
              <span>Download Free</span>
            </a>
            <Link to="/pricing" className="btn-secondary flex items-center gap-2 text-lg">
              View Plans
              <ArrowRight size={18} />
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto animate-slide-up delay-300">
            {stats.map((stat, i) => (
              <div key={i} className="text-center">
                <div className="text-3xl md:text-4xl font-bold gradient-text mb-1">{stat.value}</div>
                <div className="text-sm text-slate-500">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-float">
          <ChevronDown size={24} className="text-slate-600" />
        </div>
      </section>

      {/* Platform Downloads */}
      <section className="relative py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-12">
            <span className="gradient-text">Download</span> for your platform
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {platforms.map(p => {
              const Icon = p.icon;
              return (
                <a
                  key={p.name}
                  href={`${RELEASE_BASE}/${p.file}`}
                  className="group glass-card rounded-2xl p-6 text-center hover-lift hover:border-cyan/30 transition-all"
                >
                  <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-gradient-to-br from-cyan/10 to-purple/10 flex items-center justify-center group-hover:from-cyan/20 group-hover:to-purple/20 transition-colors">
                    <Icon size={28} className="text-cyan" />
                  </div>
                  <div className="font-medium text-white mb-1">{p.name}</div>
                  <div className="text-xs text-slate-500">v{VERSION}</div>
                </a>
              );
            })}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative py-32 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6">
              Everything you need,
              <br />
              <span className="gradient-text">nothing you don't</span>
            </h2>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              A complete development environment with AI assistance built right in.
              No plugins required.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className="feature-card glass-card rounded-2xl p-8 hover-lift transition-all group"
                  style={{ animationDelay: `${i * 100}ms` }}
                >
                  <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${f.gradient} bg-opacity-20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                    <Icon size={28} className="text-white" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-3">{f.title}</h3>
                  <p className="text-slate-400 leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Why SentinelOps */}
      <section className="relative py-32 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-8">
                Built for developers who value
                <span className="gradient-text"> freedom</span>
              </h2>
              <p className="text-lg text-slate-400 mb-10">
                No vendor lock-in. No forced cloud. No subscription required for core features.
                Your code, your AI, your choice.
              </p>

              <div className="space-y-6">
                {[
                  { icon: Zap, title: 'Zero Latency', desc: 'Local AI runs instantly with no API delays' },
                  { icon: Shield, title: 'Privacy First', desc: 'Your code never leaves your machine' },
                  { icon: Globe, title: 'Cloud Option', desc: 'Access 400+ models when you need them' },
                  { icon: Cpu, title: 'Resource Smart', desc: 'Optimized for performance on any hardware' },
                ].map(item => (
                  <div key={item.title} className="flex gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan/10 to-purple/10 flex items-center justify-center flex-shrink-0">
                      <item.icon size={22} className="text-cyan" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white mb-1">{item.title}</h3>
                      <p className="text-slate-500 text-sm">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="glass-card rounded-3xl p-8 lg:p-12">
                <div className="text-sm text-cyan font-medium mb-4">Local AI Performance</div>
                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-slate-400">Response Time</span>
                      <span className="text-white font-medium">Instant</span>
                    </div>
                    <div className="h-2 rounded-full bg-midnight-200 overflow-hidden">
                      <div className="h-full w-full bg-gradient-to-r from-cyan to-purple rounded-full" />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-slate-400">Privacy Level</span>
                      <span className="text-white font-medium">100%</span>
                    </div>
                    <div className="h-2 rounded-full bg-midnight-200 overflow-hidden">
                      <div className="h-full w-full bg-gradient-to-r from-purple to-coral rounded-full" />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-slate-400">Daily Limits</span>
                      <span className="text-white font-medium">None</span>
                    </div>
                    <div className="h-2 rounded-full bg-midnight-200 overflow-hidden">
                      <div className="h-full w-full bg-gradient-to-r from-cyan to-cyan/50 rounded-full" />
                    </div>
                  </div>
                </div>
              </div>
              {/* Decorative glow */}
              <div className="absolute -inset-4 bg-gradient-to-br from-cyan/10 via-transparent to-purple/10 rounded-3xl blur-2xl -z-10" />
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="relative py-32 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Frequently asked <span className="gradient-text">questions</span>
            </h2>
            <p className="text-slate-400">Everything you need to know about SentinelOps</p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, idx) => (
              <div
                key={idx}
                className="glass-card rounded-2xl overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full px-6 py-5 flex items-center justify-between text-left group"
                >
                  <span className="font-medium text-white pr-4 group-hover:text-cyan transition-colors">
                    {faq.q}
                  </span>
                  <ChevronDown
                    size={20}
                    className={`text-slate-500 flex-shrink-0 transition-transform duration-300 ${
                      openFaq === idx ? 'rotate-180 text-cyan' : ''
                    }`}
                  />
                </button>
                <div
                  className={`overflow-hidden transition-all duration-300 ${
                    openFaq === idx ? 'max-h-40' : 'max-h-0'
                  }`}
                >
                  <div className="px-6 pb-5 text-slate-400 leading-relaxed">
                    {faq.a}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative py-32 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="relative glass-card rounded-3xl p-12 md:p-16 text-center overflow-hidden">
            {/* Background glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-cyan/5 via-transparent to-purple/5" />
            <div className="absolute -top-32 -right-32 w-64 h-64 bg-cyan/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-32 -left-32 w-64 h-64 bg-purple/10 rounded-full blur-3xl" />

            <div className="relative">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan/10 border border-cyan/20 mb-8">
                <Check size={16} className="text-cyan" />
                <span className="text-sm text-cyan font-medium">Start coding in minutes</span>
              </div>

              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6">
                Ready to build <span className="gradient-text">faster</span>?
              </h2>

              <p className="text-lg text-slate-400 mb-10 max-w-2xl mx-auto">
                Join developers who've discovered a better way to code.
                Free forever, upgrade when you're ready.
              </p>

              <div className="flex flex-wrap justify-center gap-4">
                <a
                  href="https://github.com/LuminaryxApp/sentinelops/releases/latest"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary flex items-center gap-2 text-lg"
                >
                  <Download size={20} />
                  <span>Download Now</span>
                </a>
                <Link to="/pricing" className="btn-secondary flex items-center gap-2 text-lg">
                  View Pricing
                  <ArrowRight size={18} />
                </Link>
              </div>

              <p className="mt-8 text-sm text-slate-500">
                No credit card required &bull; Works offline &bull; Open source
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
