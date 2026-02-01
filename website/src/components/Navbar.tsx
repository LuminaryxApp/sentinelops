import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogIn, LogOut, User, ChevronDown, Menu, X, Sparkles, MessageSquare, LayoutDashboard } from 'lucide-react';
import AuthModal from './AuthModal';

export default function Navbar() {
  const { user, loading, signOut } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { to: '/chat', label: 'Chat', icon: MessageSquare },
    { to: '/pricing', label: 'Pricing' },
    { to: '/docs', label: 'Docs' },
    { to: '/changelog', label: 'Changelog' },
  ];

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'py-3 glass border-b border-white/5'
            : 'py-5 bg-transparent'
        }`}
      >
        <nav className="max-w-6xl mx-auto px-6 flex items-center justify-between">
          {/* Logo */}
          <Link
            to="/"
            className="flex items-center gap-3 group"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-cyan/20 rounded-lg blur-lg opacity-0 group-hover:opacity-100 transition-opacity" />
              <img src="/favicon.svg" alt="SentinelOps" className="w-9 h-9 relative" />
            </div>
            <span className="hidden sm:block text-lg font-semibold text-white group-hover:text-cyan transition-colors">
              SentinelOps
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map(link => (
              <Link
                key={link.to}
                to={link.to}
                className={`relative px-4 py-2 text-sm font-medium transition-colors ${
                  location.pathname === link.to
                    ? 'text-cyan'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {link.label}
                {location.pathname === link.to && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-cyan rounded-full" />
                )}
              </Link>
            ))}
          </div>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-4">
            {loading ? (
              <div className="w-20 h-9 rounded-lg bg-white/5 animate-pulse" />
            ) : user ? (
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl glass-subtle hover:bg-white/5 transition-colors"
                  aria-expanded={showUserMenu}
                >
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan/20 to-purple/20 flex items-center justify-center">
                    <User size={14} className="text-cyan" />
                  </div>
                  <span className="text-sm text-white">{user.name}</span>
                  {user.subscription.plan !== 'free' && (
                    <span className="px-2 py-0.5 text-2xs font-semibold uppercase bg-gradient-to-r from-cyan/20 to-purple/20 text-cyan rounded-full">
                      {user.subscription.plan}
                    </span>
                  )}
                  <ChevronDown size={14} className={`text-slate-500 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
                </button>

                {showUserMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowUserMenu(false)}
                    />
                    <div className="absolute right-0 top-full mt-2 w-56 glass-card rounded-xl overflow-hidden z-50 animate-slide-up">
                      <div className="px-4 py-3 border-b border-white/5">
                        <div className="text-sm font-medium text-white truncate">{user.name}</div>
                        <div className="text-xs text-slate-500 truncate">{user.email}</div>
                      </div>
                      <Link
                        to="/dashboard"
                        onClick={() => setShowUserMenu(false)}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-400 hover:text-cyan hover:bg-cyan/5 transition-colors"
                      >
                        <LayoutDashboard size={16} />
                        Dashboard
                      </Link>
                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          signOut();
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-400 hover:text-coral hover:bg-coral/5 transition-colors"
                      >
                        <LogOut size={16} />
                        Sign out
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <button
                onClick={() => setShowAuthModal(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:text-white border border-white/10 hover:border-cyan/30 rounded-xl transition-all hover:shadow-glow-cyan/20"
              >
                <LogIn size={16} />
                Sign in
              </button>
            )}

            <a
              href="https://github.com/LuminaryxApp/sentinelops/releases/latest"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary flex items-center gap-2 text-sm !py-2 !px-5"
            >
              <Sparkles size={16} />
              <span>Download</span>
            </a>
          </div>

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            className="md:hidden p-2 text-slate-400 hover:text-white transition-colors"
            aria-label="Toggle menu"
          >
            {showMobileMenu ? <X size={24} /> : <Menu size={24} />}
          </button>
        </nav>

        {/* Mobile Menu */}
        {showMobileMenu && (
          <div className="md:hidden absolute top-full left-0 right-0 glass border-t border-white/5 animate-slide-up">
            <div className="max-w-6xl mx-auto px-6 py-6 space-y-4">
              {navLinks.map(link => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setShowMobileMenu(false)}
                  className={`block py-2 text-lg font-medium transition-colors ${
                    location.pathname === link.to ? 'text-cyan' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {link.label}
                </Link>
              ))}

              <div className="pt-4 border-t border-white/5 space-y-4">
                {loading ? (
                  <div className="h-10 rounded-lg bg-white/5 animate-pulse" />
                ) : user ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan/20 to-purple/20 flex items-center justify-center">
                        <User size={18} className="text-cyan" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-white">{user.name}</div>
                        <div className="text-xs text-slate-500">{user.email}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setShowMobileMenu(false);
                        signOut();
                      }}
                      className="flex items-center gap-2 text-sm text-coral"
                    >
                      <LogOut size={16} />
                      Sign out
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setShowMobileMenu(false);
                      setShowAuthModal(true);
                    }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm text-slate-300 border border-white/10 rounded-xl"
                  >
                    <LogIn size={16} />
                    Sign in
                  </button>
                )}

                <a
                  href="https://github.com/LuminaryxApp/sentinelops/releases/latest"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setShowMobileMenu(false)}
                  className="btn-primary w-full flex items-center justify-center gap-2 text-sm"
                >
                  <Sparkles size={16} />
                  <span>Download</span>
                </a>
              </div>
            </div>
          </div>
        )}
      </header>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        initialMode="signin"
      />
    </>
  );
}
