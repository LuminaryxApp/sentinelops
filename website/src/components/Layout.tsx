import { Link } from 'react-router-dom';
import { Github, ExternalLink } from 'lucide-react';
import Navbar from './Navbar';

export default function Layout({ children }: { children?: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1">
        {children}
      </main>

      <footer className="relative border-t border-white/5 mt-24">
        {/* Gradient line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan/30 to-transparent" />

        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
            {/* Brand */}
            <div className="lg:col-span-1">
              <Link to="/" className="flex items-center gap-3 mb-4 group">
                <img src="/favicon.svg" alt="SentinelOps" className="w-8 h-8" />
                <span className="font-semibold text-white group-hover:text-cyan transition-colors">
                  SentinelOps
                </span>
              </Link>
              <p className="text-sm text-slate-500 mb-4">
                AI-powered development environment.
                Code smarter, build faster.
              </p>
              <a
                href="https://github.com/LuminaryxApp/sentinelops"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-cyan transition-colors"
              >
                <Github size={16} />
                View on GitHub
              </a>
            </div>

            {/* Product */}
            <div>
              <h3 className="font-semibold text-white mb-4 text-sm">Product</h3>
              <ul className="space-y-3">
                <li>
                  <Link to="/pricing" className="text-sm text-slate-500 hover:text-cyan transition-colors">
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link to="/docs" className="text-sm text-slate-500 hover:text-cyan transition-colors">
                    Documentation
                  </Link>
                </li>
                <li>
                  <Link to="/changelog" className="text-sm text-slate-500 hover:text-cyan transition-colors">
                    Changelog
                  </Link>
                </li>
                <li>
                  <a
                    href="https://github.com/LuminaryxApp/sentinelops/releases/latest"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-slate-500 hover:text-cyan transition-colors inline-flex items-center gap-1"
                  >
                    Download
                    <ExternalLink size={10} />
                  </a>
                </li>
              </ul>
            </div>

            {/* Resources */}
            <div>
              <h3 className="font-semibold text-white mb-4 text-sm">Resources</h3>
              <ul className="space-y-3">
                <li>
                  <a
                    href="https://ollama.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-slate-500 hover:text-cyan transition-colors inline-flex items-center gap-1"
                  >
                    Ollama
                    <ExternalLink size={10} />
                  </a>
                </li>
                <li>
                  <a
                    href="https://lmstudio.ai"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-slate-500 hover:text-cyan transition-colors inline-flex items-center gap-1"
                  >
                    LM Studio
                    <ExternalLink size={10} />
                  </a>
                </li>
                <li>
                  <a
                    href="https://openrouter.ai"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-slate-500 hover:text-cyan transition-colors inline-flex items-center gap-1"
                  >
                    OpenRouter
                    <ExternalLink size={10} />
                  </a>
                </li>
              </ul>
            </div>

            {/* Community */}
            <div>
              <h3 className="font-semibold text-white mb-4 text-sm">Community</h3>
              <ul className="space-y-3">
                <li>
                  <a
                    href="https://github.com/LuminaryxApp/sentinelops"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-slate-500 hover:text-cyan transition-colors inline-flex items-center gap-1"
                  >
                    GitHub
                    <ExternalLink size={10} />
                  </a>
                </li>
                <li>
                  <a
                    href="https://github.com/LuminaryxApp/sentinelops/issues"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-slate-500 hover:text-cyan transition-colors inline-flex items-center gap-1"
                  >
                    Issues
                    <ExternalLink size={10} />
                  </a>
                </li>
                <li>
                  <a
                    href="https://github.com/LuminaryxApp/sentinelops/discussions"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-slate-500 hover:text-cyan transition-colors inline-flex items-center gap-1"
                  >
                    Discussions
                    <ExternalLink size={10} />
                  </a>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom */}
          <div className="pt-8 border-t border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-sm text-slate-600">
              &copy; {new Date().getFullYear()} SentinelOps. Open source and free to use.
            </p>
            <div className="flex items-center gap-1 text-sm text-slate-600">
              Made with
              <span className="text-coral mx-1">&#9829;</span>
              for developers
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
