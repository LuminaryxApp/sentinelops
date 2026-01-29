import { useState } from 'react';
import { X, Mail, Lock, User, Loader2, Eye, EyeOff } from 'lucide-react';
import { authService } from '../services/authService';
import { useStore } from '../hooks/useStore';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { setAuthUser, addNotification } = useStore();
  const [isSignUp, setIsSignUp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (isSignUp) {
        // Validation
        if (!formData.name.trim()) {
          setError('Please enter your name');
          setIsLoading(false);
          return;
        }
        if (!formData.email.trim()) {
          setError('Please enter your email');
          setIsLoading(false);
          return;
        }
        if (formData.password.length < 8) {
          setError('Password must be at least 8 characters');
          setIsLoading(false);
          return;
        }

        const result = await authService.signUp({
          email: formData.email,
          password: formData.password,
          name: formData.name,
        });

        if (!result.success) {
          setError(result.error || 'Failed to create account');
          setIsLoading(false);
          return;
        }

        if (result.user) {
          setAuthUser(result.user);
          addNotification({
            type: 'success',
            title: 'Account Created!',
            message: `Welcome to SentinelOps, ${result.user.name}!`,
          });
          onClose();
        }
      } else {
        // Sign in
        if (!formData.email.trim() || !formData.password) {
          setError('Please enter email and password');
          setIsLoading(false);
          return;
        }

        const result = await authService.signIn({
          email: formData.email,
          password: formData.password,
        });

        if (!result.success) {
          setError(result.error || 'Invalid email or password');
          setIsLoading(false);
          return;
        }

        if (result.user) {
          setAuthUser(result.user);
          addNotification({
            type: 'success',
            title: 'Signed In!',
            message: `Welcome back, ${result.user.name}!`,
          });
          onClose();
        }
      }
    } catch (err) {
      console.error('Auth error:', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-[#1E1E1E] border border-[#3E3E42] rounded-xl w-[400px] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#3E3E42]">
          <h2 className="text-lg font-semibold text-[#E0E0E0]">
            {isSignUp ? 'Create Account' : 'Sign In'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-[#3E3E42] rounded transition-colors"
          >
            <X size={20} className="text-[#858585]" />
          </button>
        </div>

        {/* Form - Enter submits (explicit for Tauri webview) */}
        <form
          onSubmit={handleSubmit}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
              e.preventDefault();
              handleSubmit(e as unknown as React.FormEvent);
            }
          }}
          className="p-5 space-y-4"
        >
          {isSignUp && (
            <div>
              <label className="block text-sm text-[#858585] mb-1.5">Name</label>
              <div className="relative">
                <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#858585]" />
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Your name"
                  className="w-full pl-10 pr-4 py-2.5 bg-[#2D2D2D] border border-[#3E3E42] rounded-lg text-[#E0E0E0] placeholder-[#606060] focus:border-[#0078D4] focus:outline-none"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm text-[#858585] mb-1.5">Email</label>
            <div className="relative">
              <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#858585]" />
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="you@example.com"
                className="w-full pl-10 pr-4 py-2.5 bg-[#2D2D2D] border border-[#3E3E42] rounded-lg text-[#E0E0E0] placeholder-[#606060] focus:border-[#0078D4] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-[#858585] mb-1.5">Password</label>
            <div className="relative">
              <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#858585]" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder={isSignUp ? 'At least 8 characters' : 'Your password'}
                className="w-full pl-10 pr-10 py-2.5 bg-[#2D2D2D] border border-[#3E3E42] rounded-lg text-[#E0E0E0] placeholder-[#606060] focus:border-[#0078D4] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#858585] hover:text-[#E0E0E0]"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-[#F48771]/10 border border-[#F48771]/30 text-[#F48771] text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 rounded-lg bg-[#0078D4] text-white font-medium hover:bg-[#106EBE] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                {isSignUp ? 'Creating Account...' : 'Signing In...'}
              </>
            ) : (
              isSignUp ? 'Create Account' : 'Sign In'
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="px-5 pb-5 text-center">
          <p className="text-sm text-[#858585]">
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError(null);
              }}
              className="text-[#0078D4] hover:underline"
            >
              {isSignUp ? 'Sign In' : 'Create one'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
