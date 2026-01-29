import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Sparkles,
  Terminal,
  Palette,
  Brain,
  Rocket,
  ChevronRight,
  ChevronLeft,
  Check,
  Zap,
  Moon,
  Sun,
  Coffee,
  Code2,
  FolderOpen,
  Settings,
  Keyboard,
  Wand2,
  Import,
  Eye,
  EyeOff,
  Loader2,
  User,
  Mail,
  Lock,
  UserPlus,
  LogIn,
  Shield,
  Crown,
} from 'lucide-react';
import { useStore, KeyboardPreset } from '../hooks/useStore';
import { api } from '../services/api';
import { platform } from '@tauri-apps/plugin-os';
import { readTextFile, exists } from '@tauri-apps/plugin-fs';
import { homeDir } from '@tauri-apps/api/path';
import { authService } from '../services/authService';
import { open } from '@tauri-apps/plugin-shell';

// ============================================================================
// Types
// ============================================================================

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  hue: number;
}

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  unlocked: boolean;
}

type SetupPhase =
  | 'welcome'
  | 'account'
  | 'personality'
  | 'workspace'
  | 'editor'
  | 'theme'
  | 'ai'
  | 'keybinds'
  | 'import'
  | 'complete';

interface SetupState {
  // Account
  email: string;
  password: string;
  confirmPassword: string;
  name: string;
  agreeToTerms: boolean;
  createAccount: boolean; // Whether user wants to create account
  // Preferences
  personality: 'minimal' | 'balanced' | 'maximal';
  workspacePath: string;
  fontSize: number;
  tabSize: number;
  wordWrap: boolean;
  minimap: boolean;
  autoSave: boolean;
  theme: 'dark' | 'light' | 'auto';
  mood: 'focused' | 'creative' | 'relaxed';
  aiEnabled: boolean;
  keybindPreset: 'default' | 'vim' | 'vscode' | 'sublime';
  importFrom: string | null;
}

// ============================================================================
// Particle Background Component
// ============================================================================

function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationRef = useRef<number>();
  const mousePosRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Track mouse position without causing re-renders
    const handleMouseMove = (e: MouseEvent) => {
      mousePosRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('mousemove', handleMouseMove);

    // Initialize particles only once
    if (particlesRef.current.length === 0) {
      particlesRef.current = Array.from({ length: 50 }, (_, i) => ({
        id: i,
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        size: Math.random() * 2 + 1,
        opacity: Math.random() * 0.4 + 0.1,
        hue: Math.random() * 60 + 200,
      }));
    }

    const animate = () => {
      // Clear with semi-transparent fill for trail effect
      ctx.fillStyle = 'rgba(15, 15, 20, 0.15)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const mousePos = mousePosRef.current;

      particlesRef.current.forEach((p, i) => {
        // Gentle mouse attraction (much softer)
        const dx = mousePos.x - p.x;
        const dy = mousePos.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 150 && dist > 0) {
          const force = (150 - dist) / 150 * 0.0008;
          p.vx += dx * force;
          p.vy += dy * force;
        }

        // Add slight random movement
        p.vx += (Math.random() - 0.5) * 0.01;
        p.vy += (Math.random() - 0.5) * 0.01;

        // Update position
        p.x += p.vx;
        p.y += p.vy;

        // Strong friction to keep things calm
        p.vx *= 0.98;
        p.vy *= 0.98;

        // Clamp velocity
        const maxVel = 1;
        p.vx = Math.max(-maxVel, Math.min(maxVel, p.vx));
        p.vy = Math.max(-maxVel, Math.min(maxVel, p.vy));

        // Wrap around bounds
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        // Draw particle with glow
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 70%, 60%, ${p.opacity})`;
        ctx.fill();

        // Draw connections (limit to nearby particles for performance)
        for (let j = i + 1; j < Math.min(i + 10, particlesRef.current.length); j++) {
          const p2 = particlesRef.current[j];
          const d = Math.sqrt((p.x - p2.x) ** 2 + (p.y - p2.y) ** 2);
          if (d < 120) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `hsla(${(p.hue + p2.hue) / 2}, 60%, 50%, ${(1 - d / 120) * 0.15})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ background: 'linear-gradient(135deg, #0f0f14 0%, #1a1a2e 50%, #16213e 100%)' }}
    />
  );
}

// ============================================================================
// Typewriter Text Component
// ============================================================================

function TypewriterText({ text, speed = 50, onComplete }: { text: string; speed?: number; onComplete?: () => void }) {
  const [displayed, setDisplayed] = useState('');
  const [cursorVisible, setCursorVisible] = useState(true);

  useEffect(() => {
    setDisplayed('');
    let i = 0;
    const interval = setInterval(() => {
      if (i < text.length) {
        setDisplayed(text.slice(0, i + 1));
        i++;
      } else {
        clearInterval(interval);
        onComplete?.();
      }
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed, onComplete]);

  useEffect(() => {
    const blink = setInterval(() => setCursorVisible(v => !v), 530);
    return () => clearInterval(blink);
  }, []);

  return (
    <span>
      {displayed}
      <span className={`${cursorVisible ? 'opacity-100' : 'opacity-0'} transition-opacity`}>|</span>
    </span>
  );
}

// ============================================================================
// Glowing Button Component
// ============================================================================

function GlowButton({
  children,
  onClick,
  variant = 'primary',
  disabled = false,
  icon,
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  icon?: React.ReactNode;
}) {
  const baseClasses = "relative px-6 py-3 rounded-xl font-medium transition-all duration-300 flex items-center gap-2 overflow-hidden";

  const variants = {
    primary: `bg-gradient-to-r from-[#0078D4] to-[#00BCF2] text-white
              hover:shadow-[0_0_30px_rgba(0,120,212,0.5)]
              active:scale-95 disabled:opacity-50`,
    secondary: `bg-[#2D2D2D] text-[#E0E0E0] border border-[#3E3E42]
                hover:border-[#0078D4] hover:shadow-[0_0_20px_rgba(0,120,212,0.3)]
                active:scale-95 disabled:opacity-50`,
    ghost: `text-[#858585] hover:text-[#E0E0E0] hover:bg-[#2D2D2D]/50
            active:scale-95 disabled:opacity-50`,
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${variants[variant]}`}
    >
      {variant === 'primary' && (
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent
                        translate-x-[-200%] hover:translate-x-[200%] transition-transform duration-1000" />
      )}
      {icon}
      {children}
    </button>
  );
}

// ============================================================================
// Option Card Component
// ============================================================================

function OptionCard({
  selected,
  onClick,
  icon,
  title,
  description,
  tag,
}: {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
  tag?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative p-6 rounded-2xl border-2 text-left transition-all duration-300 group
                  ${selected
                    ? 'border-[#0078D4] bg-[#0078D4]/10 shadow-[0_0_30px_rgba(0,120,212,0.3)]'
                    : 'border-[#3E3E42] bg-[#1E1E1E]/50 hover:border-[#505050] hover:bg-[#2D2D2D]/50'
                  }`}
    >
      {selected && (
        <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-[#0078D4] flex items-center justify-center">
          <Check size={14} className="text-white" />
        </div>
      )}
      {tag && (
        <span className="absolute top-3 right-3 px-2 py-0.5 text-xs rounded-full bg-[#89D185]/20 text-[#89D185]">
          {tag}
        </span>
      )}
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-colors
                       ${selected ? 'bg-[#0078D4]/20 text-[#0078D4]' : 'bg-[#2D2D2D] text-[#858585] group-hover:text-[#E0E0E0]'}`}>
        {icon}
      </div>
      <h3 className={`text-lg font-semibold mb-2 ${selected ? 'text-[#0078D4]' : 'text-[#E0E0E0]'}`}>
        {title}
      </h3>
      <p className="text-sm text-[#858585]">{description}</p>
    </button>
  );
}

// ============================================================================
// Progress Indicator
// ============================================================================

function ProgressIndicator({ phases, currentPhase }: { phases: SetupPhase[]; currentPhase: SetupPhase }) {
  const currentIndex = phases.indexOf(currentPhase);

  return (
    <div className="flex items-center gap-2">
      {phases.map((phase, i) => (
        <div key={phase} className="flex items-center">
          <div
            className={`w-2 h-2 rounded-full transition-all duration-500 ${
              i < currentIndex
                ? 'bg-[#89D185] scale-100'
                : i === currentIndex
                ? 'bg-[#0078D4] scale-125 shadow-[0_0_10px_rgba(0,120,212,0.5)]'
                : 'bg-[#3E3E42] scale-100'
            }`}
          />
          {i < phases.length - 1 && (
            <div className={`w-8 h-0.5 transition-colors duration-500 ${
              i < currentIndex ? 'bg-[#89D185]' : 'bg-[#3E3E42]'
            }`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Code Preview Component
// ============================================================================

function CodePreview({ settings }: { settings: SetupState }) {
  // Create indentation based on tabSize
  const indent = ' '.repeat(settings.tabSize);

  const code = `// Welcome to SentinelOps, ${settings.name || 'Developer'}!
import { createApp } from 'sentinelops';

const config = {
${indent}theme: '${settings.theme}',
${indent}mood: '${settings.mood}',
${indent}ai: ${settings.aiEnabled},
${indent}fontSize: ${settings.fontSize},
${indent}tabSize: ${settings.tabSize},
};

async function main() {
${indent}const app = await createApp(config);

${indent}// Your journey begins here...
${indent}app.start();
}

main();`;

  // Theme colors
  const isLight = settings.theme === 'light';
  const bgColor = isLight ? '#FFFFFF' : '#1E1E1E';
  const headerBg = isLight ? '#F3F3F3' : '#2D2D2D';
  const borderColor = isLight ? '#E0E0E0' : '#3E3E42';
  const textColor = isLight ? '#333333' : '#D4D4D4';
  const lineNumColor = isLight ? '#999999' : '#858585';
  const commentColor = isLight ? '#008000' : '#6A9955';
  const keywordColor = isLight ? '#AF00DB' : '#C586C0';

  // Mood accent colors
  const moodColors: Record<string, string> = {
    focused: '#0078D4',
    creative: '#9C27B0',
    relaxed: '#4EC9B0',
  };
  const moodAccent = moodColors[settings.mood] || moodColors.focused;

  return (
    <div
      className="rounded-xl overflow-hidden border relative"
      style={{ borderColor }}
    >
      {/* Title bar */}
      <div
        className="flex items-center gap-2 px-4 py-2 border-b"
        style={{ backgroundColor: headerBg, borderColor }}
      >
        <div className="w-3 h-3 rounded-full bg-[#F48771]" />
        <div className="w-3 h-3 rounded-full bg-[#DCB67A]" />
        <div className="w-3 h-3 rounded-full bg-[#89D185]" />
        <span className="ml-2 text-xs" style={{ color: lineNumColor }}>preview.ts</span>
        <div className="flex-1" />
        {/* Mood indicator */}
        <div
          className="px-2 py-0.5 rounded text-xs font-medium capitalize"
          style={{ backgroundColor: `${moodAccent}20`, color: moodAccent }}
        >
          {settings.mood}
        </div>
        {/* AI indicator */}
        {settings.aiEnabled && (
          <div className="px-2 py-0.5 rounded text-xs font-medium bg-[#9C27B0]/20 text-[#9C27B0]">
            AI
          </div>
        )}
        {/* Auto-save indicator */}
        {settings.autoSave && (
          <div className="px-2 py-0.5 rounded text-xs font-medium bg-[#89D185]/20 text-[#89D185]">
            Auto-save
          </div>
        )}
      </div>

      {/* Code area with optional minimap */}
      <div className="flex" style={{ backgroundColor: bgColor }}>
        {/* Main code area */}
        <pre
          className="flex-1 p-4 overflow-x-auto font-mono"
          style={{
            fontSize: `${settings.fontSize}px`,
            lineHeight: '1.5',
            whiteSpace: settings.wordWrap ? 'pre-wrap' : 'pre',
            wordBreak: settings.wordWrap ? 'break-word' : 'normal',
          }}
        >
          <code>
            {code.split('\n').map((line, i) => (
              <div key={i} className="flex">
                <span
                  className="text-right pr-4 select-none flex-shrink-0"
                  style={{ width: '2.5em', color: lineNumColor }}
                >
                  {i + 1}
                </span>
                <span style={{ color: textColor }}>
                  {line.includes('//') ? (
                    <span style={{ color: commentColor }}>{line}</span>
                  ) : line.trimStart().startsWith('import') || line.trimStart().startsWith('const') || line.trimStart().startsWith('async') || line.trimStart().startsWith('await') ? (
                    <>
                      <span style={{ color: keywordColor }}>{line.split(' ')[0]}</span>
                      <span>{line.slice(line.indexOf(' '))}</span>
                    </>
                  ) : (
                    line
                  )}
                </span>
              </div>
            ))}
          </code>
        </pre>

        {/* Minimap */}
        {settings.minimap && (
          <div
            className="w-16 flex-shrink-0 border-l p-1 overflow-hidden"
            style={{ backgroundColor: bgColor, borderColor }}
          >
            <div className="text-[2px] leading-[3px] font-mono opacity-50 select-none" style={{ color: textColor }}>
              {code.split('\n').map((line, i) => (
                <div key={i} className="truncate">
                  {line || '\u00A0'}
                </div>
              ))}
            </div>
            {/* Viewport indicator */}
            <div
              className="absolute top-8 right-1 w-14 h-8 rounded opacity-20"
              style={{ backgroundColor: moodAccent }}
            />
          </div>
        )}
      </div>

      {/* Status bar */}
      <div
        className="flex items-center justify-between px-3 py-1 text-xs border-t"
        style={{ backgroundColor: headerBg, borderColor, color: lineNumColor }}
      >
        <span>TypeScript</span>
        <div className="flex items-center gap-3">
          <span>Tab Size: {settings.tabSize}</span>
          <span>Font: {settings.fontSize}px</span>
          <span>{settings.wordWrap ? 'Wrap: On' : 'Wrap: Off'}</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Achievement Toast
// ============================================================================

function AchievementToast({ achievement, onClose }: { achievement: Achievement; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed bottom-8 right-8 animate-slide-up">
      <div className="flex items-center gap-4 px-6 py-4 rounded-2xl bg-gradient-to-r from-[#1E1E1E] to-[#2D2D2D]
                      border border-[#89D185]/50 shadow-[0_0_30px_rgba(137,209,133,0.3)]">
        <div className="w-12 h-12 rounded-xl bg-[#89D185]/20 flex items-center justify-center text-[#89D185]">
          {achievement.icon}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-[#DCB67A]" />
            <span className="text-xs text-[#DCB67A] font-medium">Achievement Unlocked!</span>
          </div>
          <h4 className="text-[#E0E0E0] font-semibold">{achievement.title}</h4>
          <p className="text-xs text-[#858585]">{achievement.description}</p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Setup Wizard Component
// ============================================================================

export default function SetupWizard({ onComplete }: { onComplete: () => void }) {
  const { updateSettings, applyKeyboardPreset, addNotification, setAuthUser } = useStore();

  const [phase, setPhase] = useState<SetupPhase>('welcome');
  const [isAnimating, setIsAnimating] = useState(false);
  const [showAchievement, setShowAchievement] = useState<Achievement | null>(null);
  const [unlockedAchievements, setUnlockedAchievements] = useState<Set<string>>(new Set());
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const [state, setState] = useState<SetupState>({
    // Account
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    agreeToTerms: false,
    createAccount: true,
    // Preferences
    personality: 'balanced',
    workspacePath: '',
    fontSize: 14,
    tabSize: 2,
    wordWrap: true,
    minimap: true,
    autoSave: true,
    theme: 'dark',
    mood: 'focused',
    aiEnabled: true,
    keybindPreset: 'default',
    importFrom: null,
  });

  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);

  // Import settings from VSCode
  const importFromVSCode = async () => {
    setIsImporting(true);
    setImportStatus('idle');
    try {
      const os = await platform();
      const home = await homeDir();
      let settingsPath: string;

      // Determine VSCode settings path based on OS
      if (os === 'windows') {
        // On Windows, VSCode settings are in %APPDATA%\Code\User\settings.json
        settingsPath = `${home}AppData/Roaming/Code/User/settings.json`;
      } else if (os === 'macos') {
        settingsPath = `${home}Library/Application Support/Code/User/settings.json`;
      } else {
        settingsPath = `${home}.config/Code/User/settings.json`;
      }

      // Check if file exists
      const fileExists = await exists(settingsPath);
      if (!fileExists) {
        throw new Error('VS Code settings file not found');
      }

      // Try to read VSCode settings
      const content = await readTextFile(settingsPath);

      // Parse JSON (handle comments by stripping them - VS Code settings can have comments)
      const jsonContent = content
        .replace(/\/\/.*$/gm, '') // Remove single-line comments
        .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
        .replace(/,(\s*[}\]])/g, '$1'); // Remove trailing commas

      const vscodeSettings = JSON.parse(jsonContent);

      // Extract relevant settings
      const newState: Partial<SetupState> = {};

      if (vscodeSettings['editor.fontSize']) {
        newState.fontSize = vscodeSettings['editor.fontSize'];
      }
      if (vscodeSettings['editor.tabSize']) {
        newState.tabSize = vscodeSettings['editor.tabSize'];
      }
      if (vscodeSettings['editor.wordWrap'] !== undefined) {
        newState.wordWrap = vscodeSettings['editor.wordWrap'] === 'on' || vscodeSettings['editor.wordWrap'] === true;
      }
      if (vscodeSettings['editor.minimap.enabled'] !== undefined) {
        newState.minimap = vscodeSettings['editor.minimap.enabled'];
      }
      if (vscodeSettings['files.autoSave'] !== undefined) {
        newState.autoSave = vscodeSettings['files.autoSave'] !== 'off';
      }
      // Check for dark/light theme
      if (vscodeSettings['workbench.colorTheme']) {
        const themeName = vscodeSettings['workbench.colorTheme'].toLowerCase();
        if (themeName.includes('light')) {
          newState.theme = 'light';
        } else {
          newState.theme = 'dark';
        }
      }

      // Apply all settings at once
      setState(s => ({ ...s, ...newState }));

      setImportStatus('success');
      addNotification({
        type: 'success',
        title: 'Import Successful',
        message: 'VS Code settings have been imported!',
      });
    } catch (error) {
      console.error('Failed to import VS Code settings:', error);
      setImportStatus('error');
      addNotification({
        type: 'error',
        title: 'Import Failed',
        message: 'Could not find or read VS Code settings file.',
      });
    } finally {
      setIsImporting(false);
    }
  };

  const phases: SetupPhase[] = ['welcome', 'account', 'personality', 'workspace', 'editor', 'theme', 'ai', 'keybinds', 'import', 'complete'];

  const achievements: Achievement[] = [
    { id: 'first_step', title: 'First Steps', description: 'Started the setup wizard', icon: <Rocket size={24} />, unlocked: false },
    { id: 'named', title: 'Identity Established', description: 'Set your developer name', icon: <Terminal size={24} />, unlocked: false },
    { id: 'styled', title: 'Style Guru', description: 'Customized your editor', icon: <Palette size={24} />, unlocked: false },
    { id: 'ai_enabled', title: 'AI Whisperer', description: 'Enabled AI assistance', icon: <Brain size={24} />, unlocked: false },
    { id: 'complete', title: 'Setup Master', description: 'Completed the setup wizard', icon: <Sparkles size={24} />, unlocked: false },
  ];

  const unlockAchievement = useCallback((id: string) => {
    if (unlockedAchievements.has(id)) return;
    const achievement = achievements.find(a => a.id === id);
    if (achievement) {
      setUnlockedAchievements(prev => new Set([...prev, id]));
      setShowAchievement({ ...achievement, unlocked: true });
    }
  }, [unlockedAchievements]);

  useEffect(() => {
    // Unlock first achievement on mount
    const timer = setTimeout(() => unlockAchievement('first_step'), 1000);
    return () => clearTimeout(timer);
  }, [unlockAchievement]);

  // Initialize auth service for account creation
  useEffect(() => {
    authService.initialize().catch(err => {
      console.warn('Auth service initialization failed:', err);
    });
  }, []);

  const goToPhase = (newPhase: SetupPhase) => {
    setIsAnimating(true);
    setTimeout(() => {
      setPhase(newPhase);
      setIsAnimating(false);
    }, 300);
  };

  const nextPhase = () => {
    const currentIndex = phases.indexOf(phase);
    if (currentIndex < phases.length - 1) {
      goToPhase(phases[currentIndex + 1]);
    }
  };

  const handleAccountContinue = async () => {
    setAccountError(null);
    setIsCreatingAccount(true);
    try {
      if (state.createAccount) {
        if (!state.name.trim()) {
          setAccountError('Please enter your name');
          return;
        }
        if (!state.email.trim()) {
          setAccountError('Please enter your email');
          return;
        }
        if (state.password.length < 8) {
          setAccountError('Password must be at least 8 characters');
          return;
        }
        if (state.password !== state.confirmPassword) {
          setAccountError('Passwords do not match');
          return;
        }
        if (!state.agreeToTerms) {
          setAccountError('Please agree to the terms');
          return;
        }
        const result = await authService.signUp({
          email: state.email,
          password: state.password,
          name: state.name,
        });
        if (!result.success) {
          setAccountError(result.error || 'Failed to create account');
          return;
        }
        if (result.user) {
          setAuthUser(result.user);
          unlockAchievement('named');
          addNotification({
            type: 'success',
            title: 'Account Created!',
            message: `Welcome to SentinelOps, ${result.user.name}!`,
          });
        }
      } else {
        if (!state.email.trim() || !state.password) {
          setAccountError('Please enter email and password');
          return;
        }
        const result = await authService.signIn({
          email: state.email,
          password: state.password,
        });
        if (!result.success) {
          setAccountError(result.error || 'Invalid email or password');
          return;
        }
        if (result.user) {
          setAuthUser(result.user);
          setState(s => ({ ...s, name: result.user!.name }));
          addNotification({
            type: 'success',
            title: 'Signed In!',
            message: `Welcome back, ${result.user.name}!`,
          });
        }
      }
      onComplete();
    } catch (error) {
      console.error('Auth error:', error);
      setAccountError('Something went wrong. Please try again.');
    } finally {
      setIsCreatingAccount(false);
    }
  };

  const handleEnterKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter') return;
    const target = e.target as HTMLElement;
    if (target.tagName === 'TEXTAREA') return;
    e.preventDefault();
    if (phase === 'account') {
      handleAccountContinue();
    } else {
      nextPhase();
    }
  };

  const prevPhase = () => {
    const currentIndex = phases.indexOf(phase);
    if (currentIndex > 0) {
      goToPhase(phases[currentIndex - 1]);
    }
  };

  const handleComplete = async () => {
    // Save all settings to localStorage AND store
    const newSettings = {
      fontSize: state.fontSize,
      tabSize: state.tabSize,
      wordWrap: state.wordWrap,
      minimap: state.minimap,
      autoSave: state.autoSave,
      aiEnabled: state.aiEnabled,
      mood: state.mood,
      theme: state.theme === 'auto' ? 'dark' : state.theme as 'dark' | 'light',
    };

    // Update store (this also saves to localStorage)
    updateSettings(newSettings);

    // Apply keyboard preset
    applyKeyboardPreset(state.keybindPreset as KeyboardPreset);

    // Set workspace if provided
    if (state.workspacePath) {
      try {
        await api.setWorkspace(state.workspacePath);
      } catch (e) {
        console.error('Failed to set workspace:', e);
      }
    }

    // Mark setup as complete
    localStorage.setItem('sentinelops_setup_complete', 'true');
    localStorage.setItem('sentinelops_user_name', state.name);

    unlockAchievement('complete');

    setTimeout(() => {
      onComplete();
    }, 2000);
  };

  const renderPhase = () => {
    switch (phase) {
      case 'welcome':
        return (
          <div className="text-center max-w-2xl mx-auto">
            <div className="w-32 h-32 mx-auto mb-8 rounded-3xl bg-gradient-to-br from-[#0078D4] to-[#00BCF2]
                            flex items-center justify-center shadow-[0_0_60px_rgba(0,120,212,0.4)]
                            animate-float">
              <span className="text-6xl font-bold text-white">S</span>
            </div>

            <h1 className="text-5xl font-bold text-[#E0E0E0] mb-4">
              <TypewriterText text="Welcome to SentinelOps" speed={60} />
            </h1>

            <p className="text-xl text-[#858585] mb-12">
              Let's create your perfect development environment
            </p>

            <div className="mb-8">
              <label className="block text-sm text-[#858585] mb-2">What should we call you?</label>
              <input
                type="text"
                value={state.name}
                onChange={(e) => {
                  setState(s => ({ ...s, name: e.target.value }));
                  if (e.target.value.length > 2) unlockAchievement('named');
                }}
                placeholder="Enter your name..."
                className="w-full max-w-md mx-auto px-6 py-4 rounded-xl bg-[#1E1E1E] border-2 border-[#3E3E42]
                          text-[#E0E0E0] text-center text-xl placeholder-[#505050]
                          focus:border-[#0078D4] focus:outline-none focus:shadow-[0_0_20px_rgba(0,120,212,0.3)]
                          transition-all duration-300"
                autoFocus
              />
            </div>

            <GlowButton onClick={nextPhase} icon={<Rocket size={20} />}>
              Begin Setup
            </GlowButton>

            <p className="mt-8 text-xs text-[#505050]">
              Press Enter to continue • ESC to skip
            </p>
          </div>
        );

      case 'account':
        return (
          <div className="max-w-xl mx-auto">
            <div className="text-center mb-8">
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-[#9C27B0] to-[#E91E63]
                              flex items-center justify-center shadow-[0_0_40px_rgba(156,39,176,0.4)]">
                <UserPlus size={40} className="text-white" />
              </div>
              <h2 className="text-3xl font-bold text-[#E0E0E0] mb-2">
                Create Your Account
              </h2>
              <p className="text-[#858585]">
                Sign up to unlock cloud sync, AI features, and more
              </p>
            </div>

            {/* Account toggle */}
            <div className="flex justify-center gap-4 mb-6">
              <button
                onClick={() => setState(s => ({ ...s, createAccount: true }))}
                className={`px-6 py-3 rounded-xl font-medium transition-all flex items-center gap-2 ${
                  state.createAccount
                    ? 'bg-[#0078D4] text-white'
                    : 'bg-[#2D2D2D] text-[#858585] hover:text-white'
                }`}
              >
                <UserPlus size={18} /> Sign Up
              </button>
              <button
                onClick={() => setState(s => ({ ...s, createAccount: false }))}
                className={`px-6 py-3 rounded-xl font-medium transition-all flex items-center gap-2 ${
                  !state.createAccount
                    ? 'bg-[#0078D4] text-white'
                    : 'bg-[#2D2D2D] text-[#858585] hover:text-white'
                }`}
              >
                <LogIn size={18} /> Sign In
              </button>
            </div>

            {/* Error message */}
            {accountError && (
              <div className="mb-4 p-3 rounded-lg bg-[#3A1E1E] border border-[#5A2D2D] text-[#F48771] text-sm text-center">
                {accountError}
              </div>
            )}

            {/* Form */}
            <div className="space-y-4 bg-[#1E1E1E] rounded-2xl border border-[#3E3E42] p-6">
              {state.createAccount && (
                <div>
                  <label className="block text-sm text-[#858585] mb-2">
                    <User size={14} className="inline mr-2" />
                    Name
                  </label>
                  <input
                    type="text"
                    value={state.name}
                    onChange={(e) => setState(s => ({ ...s, name: e.target.value }))}
                    placeholder="Your name"
                    className="w-full px-4 py-3 rounded-xl bg-[#2D2D2D] border border-[#3E3E42]
                              text-[#E0E0E0] placeholder-[#505050]
                              focus:border-[#0078D4] focus:outline-none transition-all"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm text-[#858585] mb-2">
                  <Mail size={14} className="inline mr-2" />
                  Email
                </label>
                <input
                  type="email"
                  value={state.email}
                  onChange={(e) => setState(s => ({ ...s, email: e.target.value }))}
                  placeholder="you@example.com"
                  className="w-full px-4 py-3 rounded-xl bg-[#2D2D2D] border border-[#3E3E42]
                            text-[#E0E0E0] placeholder-[#505050]
                            focus:border-[#0078D4] focus:outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-sm text-[#858585] mb-2">
                  <Lock size={14} className="inline mr-2" />
                  Password
                </label>
                <input
                  type="password"
                  value={state.password}
                  onChange={(e) => setState(s => ({ ...s, password: e.target.value }))}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 rounded-xl bg-[#2D2D2D] border border-[#3E3E42]
                            text-[#E0E0E0] placeholder-[#505050]
                            focus:border-[#0078D4] focus:outline-none transition-all"
                />
              </div>

              {state.createAccount && (
                <>
                  <div>
                    <label className="block text-sm text-[#858585] mb-2">
                      <Shield size={14} className="inline mr-2" />
                      Confirm Password
                    </label>
                    <input
                      type="password"
                      value={state.confirmPassword}
                      onChange={(e) => setState(s => ({ ...s, confirmPassword: e.target.value }))}
                      placeholder="••••••••"
                      className="w-full px-4 py-3 rounded-xl bg-[#2D2D2D] border border-[#3E3E42]
                                text-[#E0E0E0] placeholder-[#505050]
                                focus:border-[#0078D4] focus:outline-none transition-all"
                    />
                  </div>

                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={state.agreeToTerms}
                      onChange={(e) => setState(s => ({ ...s, agreeToTerms: e.target.checked }))}
                      className="w-5 h-5 rounded border-2 border-[#3E3E42] bg-[#2D2D2D]
                                checked:bg-[#0078D4] checked:border-[#0078D4]
                                focus:ring-2 focus:ring-[#0078D4]/50 cursor-pointer"
                    />
                    <span className="text-sm text-[#858585] group-hover:text-[#E0E0E0]">
                      I agree to the{' '}
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          open('https://sentinelops.dev/terms');
                        }}
                        className="text-[#0078D4] hover:underline"
                      >
                        Terms of Service
                      </button>
                      {' '}and{' '}
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          open('https://sentinelops.dev/privacy');
                        }}
                        className="text-[#0078D4] hover:underline"
                      >
                        Privacy Policy
                      </button>
                    </span>
                  </label>
                </>
              )}
            </div>

            {/* Benefits */}
            <div className="mt-6 grid grid-cols-3 gap-4 text-center">
              <div className="p-3 rounded-xl bg-[#1E1E1E]/50">
                <Crown size={20} className="mx-auto mb-2 text-[#DCB67A]" />
                <p className="text-xs text-[#858585]">Cloud Sync</p>
              </div>
              <div className="p-3 rounded-xl bg-[#1E1E1E]/50">
                <Brain size={20} className="mx-auto mb-2 text-[#9C27B0]" />
                <p className="text-xs text-[#858585]">AI Features</p>
              </div>
              <div className="p-3 rounded-xl bg-[#1E1E1E]/50">
                <Zap size={20} className="mx-auto mb-2 text-[#0078D4]" />
                <p className="text-xs text-[#858585]">Pro Features</p>
              </div>
            </div>

            <div className="flex justify-between mt-8">
              <GlowButton onClick={prevPhase} variant="ghost" icon={<ChevronLeft size={20} />}>
                Back
              </GlowButton>
              <div className="flex gap-3">
                <GlowButton
                  onClick={() => {
                    // Skip account creation
                    nextPhase();
                  }}
                  variant="secondary"
                >
                  Skip for Now
                </GlowButton>
                <GlowButton
                  onClick={handleAccountContinue}
                  disabled={isCreatingAccount}
                  icon={isCreatingAccount ? <Loader2 size={20} className="animate-spin" /> : <ChevronRight size={20} />}
                >
                  {isCreatingAccount ? 'Please wait...' : state.createAccount ? 'Create Account' : 'Sign In'}
                </GlowButton>
              </div>
            </div>
          </div>
        );

      case 'personality':
        return (
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-[#E0E0E0] mb-2 text-center">
              Choose Your Style
            </h2>
            <p className="text-[#858585] mb-8 text-center">
              How do you like your development environment?
            </p>

            <div className="grid grid-cols-3 gap-6 mb-8">
              <OptionCard
                selected={state.personality === 'minimal'}
                onClick={() => setState(s => ({ ...s, personality: 'minimal' }))}
                icon={<Moon size={24} />}
                title="Minimal"
                description="Clean and distraction-free. Just you and your code."
              />
              <OptionCard
                selected={state.personality === 'balanced'}
                onClick={() => setState(s => ({ ...s, personality: 'balanced' }))}
                icon={<Coffee size={24} />}
                title="Balanced"
                description="The perfect mix of features and simplicity."
                tag="Recommended"
              />
              <OptionCard
                selected={state.personality === 'maximal'}
                onClick={() => setState(s => ({ ...s, personality: 'maximal' }))}
                icon={<Zap size={24} />}
                title="Power User"
                description="All features enabled. Maximum productivity."
              />
            </div>

            <div className="flex justify-between">
              <GlowButton onClick={prevPhase} variant="ghost" icon={<ChevronLeft size={20} />}>
                Back
              </GlowButton>
              <GlowButton onClick={nextPhase} icon={<ChevronRight size={20} />}>
                Continue
              </GlowButton>
            </div>
          </div>
        );

      case 'workspace':
        return (
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold text-[#E0E0E0] mb-2 text-center">
              Set Your Workspace
            </h2>
            <p className="text-[#858585] mb-8 text-center">
              Where do your projects live?
            </p>

            <div className="bg-[#1E1E1E] rounded-2xl border border-[#3E3E42] p-8 mb-8">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-xl bg-[#2D2D2D] flex items-center justify-center text-[#DCB67A]">
                  <FolderOpen size={32} />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-[#E0E0E0]">Default Workspace</h3>
                  <p className="text-sm text-[#858585]">This is where SentinelOps will look for your projects</p>
                </div>
              </div>

              <div className="flex gap-4">
                <input
                  type="text"
                  value={state.workspacePath}
                  onChange={(e) => setState(s => ({ ...s, workspacePath: e.target.value }))}
                  placeholder="C:\Users\YourName\Projects"
                  className="flex-1 px-4 py-3 rounded-xl bg-[#2D2D2D] border border-[#3E3E42]
                            text-[#E0E0E0] placeholder-[#505050]
                            focus:border-[#0078D4] focus:outline-none transition-all"
                />
                <GlowButton
                  onClick={async () => {
                    // Would trigger folder picker
                    const { open } = await import('@tauri-apps/plugin-dialog');
                    const selected = await open({ directory: true });
                    if (selected) setState(s => ({ ...s, workspacePath: selected as string }));
                  }}
                  variant="secondary"
                >
                  Browse
                </GlowButton>
              </div>
            </div>

            <div className="flex justify-between">
              <GlowButton onClick={prevPhase} variant="ghost" icon={<ChevronLeft size={20} />}>
                Back
              </GlowButton>
              <GlowButton onClick={nextPhase} icon={<ChevronRight size={20} />}>
                Continue
              </GlowButton>
            </div>
          </div>
        );

      case 'editor':
        return (
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-bold text-[#E0E0E0] mb-2 text-center">
              Customize Your Editor
            </h2>
            <p className="text-[#858585] mb-8 text-center">
              Fine-tune your coding experience
            </p>

            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-6">
                {/* Font Size */}
                <div className="bg-[#1E1E1E] rounded-xl border border-[#3E3E42] p-6">
                  <div className="flex items-center justify-between mb-4">
                    <label className="text-[#E0E0E0] font-medium">Font Size</label>
                    <span className="px-3 py-1 rounded-lg bg-[#2D2D2D] text-[#0078D4] font-mono">
                      {state.fontSize}px
                    </span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="24"
                    value={state.fontSize}
                    onChange={(e) => {
                      setState(s => ({ ...s, fontSize: parseInt(e.target.value) }));
                      unlockAchievement('styled');
                    }}
                    className="w-full accent-[#0078D4]"
                  />
                </div>

                {/* Tab Size */}
                <div className="bg-[#1E1E1E] rounded-xl border border-[#3E3E42] p-6">
                  <label className="text-[#E0E0E0] font-medium block mb-4">Tab Size</label>
                  <div className="flex gap-3">
                    {[2, 4, 8].map(size => (
                      <button
                        key={size}
                        onClick={() => setState(s => ({ ...s, tabSize: size }))}
                        className={`flex-1 py-3 rounded-xl font-medium transition-all ${
                          state.tabSize === size
                            ? 'bg-[#0078D4] text-white'
                            : 'bg-[#2D2D2D] text-[#858585] hover:text-[#E0E0E0]'
                        }`}
                      >
                        {size} spaces
                      </button>
                    ))}
                  </div>
                </div>

                {/* Toggles */}
                <div className="bg-[#1E1E1E] rounded-xl border border-[#3E3E42] p-6 space-y-4">
                  {[
                    { key: 'wordWrap', label: 'Word Wrap', icon: <Code2 size={18} /> },
                    { key: 'minimap', label: 'Minimap', icon: state.minimap ? <Eye size={18} /> : <EyeOff size={18} /> },
                    { key: 'autoSave', label: 'Auto Save', icon: <Settings size={18} /> },
                  ].map(({ key, label, icon }) => (
                    <div key={key} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-[#858585]">{icon}</span>
                        <span className="text-[#E0E0E0]">{label}</span>
                      </div>
                      <button
                        onClick={() => setState(s => ({ ...s, [key]: !s[key as keyof SetupState] }))}
                        className={`relative w-12 h-6 rounded-full transition-colors ${
                          state[key as keyof SetupState] ? 'bg-[#0078D4]' : 'bg-[#3E3E42]'
                        }`}
                      >
                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                          state[key as keyof SetupState] ? 'translate-x-7' : 'translate-x-1'
                        }`} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Live Preview */}
              <div>
                <h3 className="text-sm text-[#858585] mb-3 flex items-center gap-2">
                  <Eye size={14} /> Live Preview
                </h3>
                <CodePreview settings={state} />
              </div>
            </div>

            <div className="flex justify-between mt-8">
              <GlowButton onClick={prevPhase} variant="ghost" icon={<ChevronLeft size={20} />}>
                Back
              </GlowButton>
              <GlowButton onClick={nextPhase} icon={<ChevronRight size={20} />}>
                Continue
              </GlowButton>
            </div>
          </div>
        );

      case 'theme':
        return (
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-[#E0E0E0] mb-2 text-center">
              Set the Mood
            </h2>
            <p className="text-[#858585] mb-8 text-center">
              How are you feeling today? We'll match your vibe.
            </p>

            <div className="grid grid-cols-3 gap-6 mb-8">
              <OptionCard
                selected={state.mood === 'focused'}
                onClick={() => setState(s => ({ ...s, mood: 'focused' }))}
                icon={<Zap size={24} />}
                title="Focused"
                description="Deep work mode. Minimal distractions, maximum concentration."
              />
              <OptionCard
                selected={state.mood === 'creative'}
                onClick={() => setState(s => ({ ...s, mood: 'creative' }))}
                icon={<Wand2 size={24} />}
                title="Creative"
                description="Exploration mode. Let ideas flow freely."
              />
              <OptionCard
                selected={state.mood === 'relaxed'}
                onClick={() => setState(s => ({ ...s, mood: 'relaxed' }))}
                icon={<Coffee size={24} />}
                title="Relaxed"
                description="Casual coding. No pressure, just vibes."
              />
            </div>

            <div className="bg-[#1E1E1E] rounded-2xl border border-[#3E3E42] p-6 mb-8">
              <h3 className="text-lg font-medium text-[#E0E0E0] mb-4">Color Theme</h3>
              <div className="flex gap-4">
                <button
                  onClick={() => setState(s => ({ ...s, theme: 'dark' }))}
                  className={`flex-1 p-4 rounded-xl border-2 transition-all flex items-center justify-center gap-3 ${
                    state.theme === 'dark' ? 'border-[#0078D4] bg-[#0078D4]/10' : 'border-[#3E3E42]'
                  }`}
                >
                  <Moon size={20} className={state.theme === 'dark' ? 'text-[#0078D4]' : 'text-[#858585]'} />
                  <span className={state.theme === 'dark' ? 'text-[#0078D4]' : 'text-[#858585]'}>Dark</span>
                </button>
                <button
                  onClick={() => setState(s => ({ ...s, theme: 'light' }))}
                  className={`flex-1 p-4 rounded-xl border-2 transition-all flex items-center justify-center gap-3 ${
                    state.theme === 'light' ? 'border-[#0078D4] bg-[#0078D4]/10' : 'border-[#3E3E42]'
                  }`}
                >
                  <Sun size={20} className={state.theme === 'light' ? 'text-[#0078D4]' : 'text-[#858585]'} />
                  <span className={state.theme === 'light' ? 'text-[#0078D4]' : 'text-[#858585]'}>Light</span>
                </button>
                <button
                  onClick={() => setState(s => ({ ...s, theme: 'auto' }))}
                  className={`flex-1 p-4 rounded-xl border-2 transition-all flex items-center justify-center gap-3 ${
                    state.theme === 'auto' ? 'border-[#0078D4] bg-[#0078D4]/10' : 'border-[#3E3E42]'
                  }`}
                >
                  <Settings size={20} className={state.theme === 'auto' ? 'text-[#0078D4]' : 'text-[#858585]'} />
                  <span className={state.theme === 'auto' ? 'text-[#0078D4]' : 'text-[#858585]'}>System</span>
                </button>
              </div>
            </div>

            <div className="flex justify-between">
              <GlowButton onClick={prevPhase} variant="ghost" icon={<ChevronLeft size={20} />}>
                Back
              </GlowButton>
              <GlowButton onClick={nextPhase} icon={<ChevronRight size={20} />}>
                Continue
              </GlowButton>
            </div>
          </div>
        );

      case 'ai':
        return (
          <div className="max-w-3xl mx-auto text-center">
            <div className="w-24 h-24 mx-auto mb-8 rounded-2xl bg-gradient-to-br from-[#9C27B0] to-[#E91E63]
                            flex items-center justify-center shadow-[0_0_40px_rgba(156,39,176,0.4)]">
              <Brain size={48} className="text-white" />
            </div>

            <h2 className="text-3xl font-bold text-[#E0E0E0] mb-2">
              Enable AI Assistant
            </h2>
            <p className="text-[#858585] mb-8 max-w-lg mx-auto">
              SentinelOps comes with a powerful AI assistant that can help you write code,
              debug issues, and accelerate your development workflow.
            </p>

            <div className="flex justify-center gap-6 mb-8">
              <button
                onClick={() => {
                  setState(s => ({ ...s, aiEnabled: true }));
                  unlockAchievement('ai_enabled');
                }}
                className={`px-8 py-6 rounded-2xl border-2 transition-all ${
                  state.aiEnabled
                    ? 'border-[#9C27B0] bg-[#9C27B0]/10 shadow-[0_0_30px_rgba(156,39,176,0.3)]'
                    : 'border-[#3E3E42] hover:border-[#505050]'
                }`}
              >
                <Zap size={32} className={`mx-auto mb-3 ${state.aiEnabled ? 'text-[#9C27B0]' : 'text-[#858585]'}`} />
                <span className={`block font-semibold ${state.aiEnabled ? 'text-[#9C27B0]' : 'text-[#E0E0E0]'}`}>
                  Enable AI
                </span>
              </button>
              <button
                onClick={() => setState(s => ({ ...s, aiEnabled: false }))}
                className={`px-8 py-6 rounded-2xl border-2 transition-all ${
                  !state.aiEnabled
                    ? 'border-[#0078D4] bg-[#0078D4]/10'
                    : 'border-[#3E3E42] hover:border-[#505050]'
                }`}
              >
                <Code2 size={32} className={`mx-auto mb-3 ${!state.aiEnabled ? 'text-[#0078D4]' : 'text-[#858585]'}`} />
                <span className={`block font-semibold ${!state.aiEnabled ? 'text-[#0078D4]' : 'text-[#E0E0E0]'}`}>
                  Code Solo
                </span>
              </button>
            </div>

            <p className="text-xs text-[#505050] mb-8">
              You can change this later in Settings
            </p>

            <div className="flex justify-between">
              <GlowButton onClick={prevPhase} variant="ghost" icon={<ChevronLeft size={20} />}>
                Back
              </GlowButton>
              <GlowButton onClick={nextPhase} icon={<ChevronRight size={20} />}>
                Continue
              </GlowButton>
            </div>
          </div>
        );

      case 'keybinds':
        return (
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-[#E0E0E0] mb-2 text-center">
              Keyboard Shortcuts
            </h2>
            <p className="text-[#858585] mb-8 text-center">
              Choose a keybind preset that matches your muscle memory
            </p>

            <div className="grid grid-cols-2 gap-6 mb-8">
              <OptionCard
                selected={state.keybindPreset === 'default'}
                onClick={() => setState(s => ({ ...s, keybindPreset: 'default' }))}
                icon={<Keyboard size={24} />}
                title="SentinelOps Default"
                description="Modern keybindings optimized for productivity"
                tag="Recommended"
              />
              <OptionCard
                selected={state.keybindPreset === 'vscode'}
                onClick={() => setState(s => ({ ...s, keybindPreset: 'vscode' }))}
                icon={<Code2 size={24} />}
                title="VS Code"
                description="Familiar shortcuts from Visual Studio Code"
              />
              <OptionCard
                selected={state.keybindPreset === 'vim'}
                onClick={() => setState(s => ({ ...s, keybindPreset: 'vim' }))}
                icon={<Terminal size={24} />}
                title="Vim Mode"
                description="Modal editing for vim enthusiasts"
              />
              <OptionCard
                selected={state.keybindPreset === 'sublime'}
                onClick={() => setState(s => ({ ...s, keybindPreset: 'sublime' }))}
                icon={<Zap size={24} />}
                title="Sublime Text"
                description="Shortcuts from Sublime Text editor"
              />
            </div>

            <div className="flex justify-between">
              <GlowButton onClick={prevPhase} variant="ghost" icon={<ChevronLeft size={20} />}>
                Back
              </GlowButton>
              <GlowButton onClick={nextPhase} icon={<ChevronRight size={20} />}>
                Continue
              </GlowButton>
            </div>
          </div>
        );

      case 'import':
        return (
          <div className="max-w-3xl mx-auto text-center">
            <div className="w-24 h-24 mx-auto mb-8 rounded-2xl bg-gradient-to-br from-[#00BCF2] to-[#0078D4]
                            flex items-center justify-center shadow-[0_0_40px_rgba(0,188,242,0.4)]">
              <Import size={48} className="text-white" />
            </div>

            <h2 className="text-3xl font-bold text-[#E0E0E0] mb-2">
              Import Settings
            </h2>
            <p className="text-[#858585] mb-8">
              Coming from another editor? We can import your settings.
            </p>

            <div className="grid grid-cols-2 gap-4 mb-8 max-w-md mx-auto">
              <button
                onClick={async () => {
                  setState(s => ({ ...s, importFrom: 'vscode' }));
                  await importFromVSCode();
                }}
                disabled={isImporting}
                className={`p-6 rounded-xl border-2 transition-all ${
                  state.importFrom === 'vscode'
                    ? importStatus === 'success'
                      ? 'border-[#89D185] bg-[#89D185]/10'
                      : importStatus === 'error'
                      ? 'border-[#F48771] bg-[#F48771]/10'
                      : 'border-[#0078D4] bg-[#0078D4]/10'
                    : 'border-[#3E3E42] hover:border-[#505050]'
                } ${isImporting ? 'opacity-50' : ''}`}
              >
                <div className={`mx-auto mb-2 ${
                  state.importFrom === 'vscode'
                    ? importStatus === 'success'
                      ? 'text-[#89D185]'
                      : importStatus === 'error'
                      ? 'text-[#F48771]'
                      : 'text-[#0078D4]'
                    : 'text-[#858585]'
                }`}>
                  {isImporting && state.importFrom === 'vscode' ? (
                    <Loader2 size={24} className="animate-spin" />
                  ) : importStatus === 'success' && state.importFrom === 'vscode' ? (
                    <Check size={24} />
                  ) : (
                    <Code2 size={24} />
                  )}
                </div>
                <span className="text-sm text-[#E0E0E0]">
                  {isImporting && state.importFrom === 'vscode' ? 'Importing...' : 'VS Code'}
                </span>
                {importStatus === 'success' && state.importFrom === 'vscode' && (
                  <p className="text-xs text-[#89D185] mt-1">Imported!</p>
                )}
              </button>

              <button
                onClick={() => {
                  setState(s => ({ ...s, importFrom: null }));
                  setImportStatus('idle');
                }}
                className={`p-6 rounded-xl border-2 transition-all ${
                  !state.importFrom
                    ? 'border-[#0078D4] bg-[#0078D4]/10'
                    : 'border-[#3E3E42] hover:border-[#505050]'
                }`}
              >
                <div className={`mx-auto mb-2 ${!state.importFrom ? 'text-[#0078D4]' : 'text-[#858585]'}`}>
                  <ChevronRight size={24} />
                </div>
                <span className="text-sm text-[#E0E0E0]">Skip</span>
              </button>
            </div>

            {importStatus === 'success' && (
              <div className="mb-6 p-4 rounded-xl bg-[#1E3A2F] border border-[#2D5A3D] max-w-md mx-auto">
                <p className="text-sm text-[#89D185]">
                  Settings imported! Review them in the previous steps or continue to finish.
                </p>
              </div>
            )}

            {importStatus === 'error' && (
              <div className="mb-6 p-4 rounded-xl bg-[#3A1E1E] border border-[#5A2D2D] max-w-md mx-auto">
                <p className="text-sm text-[#F48771]">
                  Could not find VS Code settings. Make sure VS Code is installed.
                </p>
              </div>
            )}

            <div className="flex justify-between">
              <GlowButton onClick={prevPhase} variant="ghost" icon={<ChevronLeft size={20} />}>
                Back
              </GlowButton>
              <GlowButton onClick={nextPhase} icon={<ChevronRight size={20} />}>
                Finish Setup
              </GlowButton>
            </div>
          </div>
        );

      case 'complete':
        return (
          <div className="text-center max-w-2xl mx-auto">
            <div className="w-32 h-32 mx-auto mb-8 rounded-3xl bg-gradient-to-br from-[#89D185] to-[#4EC9B0]
                            flex items-center justify-center shadow-[0_0_60px_rgba(137,209,133,0.4)]
                            animate-bounce-slow">
              <Check size={64} className="text-white" />
            </div>

            <h1 className="text-5xl font-bold text-[#E0E0E0] mb-4">
              You're All Set{state.name ? `, ${state.name}` : ''}!
            </h1>

            <p className="text-xl text-[#858585] mb-8">
              Your development environment is ready. Let's build something amazing.
            </p>

            <div className="flex justify-center gap-4 mb-8">
              <div className="px-4 py-2 rounded-lg bg-[#1E1E1E] border border-[#3E3E42]">
                <span className="text-xs text-[#858585]">Theme</span>
                <p className="text-[#E0E0E0] capitalize">{state.theme}</p>
              </div>
              <div className="px-4 py-2 rounded-lg bg-[#1E1E1E] border border-[#3E3E42]">
                <span className="text-xs text-[#858585]">AI</span>
                <p className="text-[#E0E0E0]">{state.aiEnabled ? 'Enabled' : 'Disabled'}</p>
              </div>
              <div className="px-4 py-2 rounded-lg bg-[#1E1E1E] border border-[#3E3E42]">
                <span className="text-xs text-[#858585]">Mood</span>
                <p className="text-[#E0E0E0] capitalize">{state.mood}</p>
              </div>
            </div>

            <GlowButton onClick={handleComplete} icon={<Rocket size={20} />}>
              Launch SentinelOps
            </GlowButton>

            <div className="mt-12 flex justify-center gap-2">
              {achievements.filter(a => unlockedAchievements.has(a.id)).map(a => (
                <div
                  key={a.id}
                  className="w-10 h-10 rounded-lg bg-[#89D185]/20 text-[#89D185] flex items-center justify-center"
                  title={a.title}
                >
                  {a.icon}
                </div>
              ))}
            </div>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <ParticleBackground />

      {/* Main content */}
      <div className="relative z-10 flex flex-col h-full">
        {/* Header with progress - TAURI DRAG REGION for moving the window */}
        <header
          data-tauri-drag-region
          className="flex items-center justify-between px-8 py-6 cursor-default select-none"
        >
          <div className="flex items-center gap-3" data-tauri-drag-region>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0078D4] to-[#00BCF2] flex items-center justify-center">
              <span className="text-lg font-bold text-white">S</span>
            </div>
            <span className="text-[#E0E0E0] font-semibold">SentinelOps Setup</span>
          </div>

          <div data-tauri-drag-region>
            <ProgressIndicator phases={phases} currentPhase={phase} />
          </div>

          <button
            onClick={() => {
              // Mark setup as complete even when skipping
              localStorage.setItem('sentinelops_setup_complete', 'true');
              onComplete();
            }}
            className="text-sm text-[#858585] hover:text-[#E0E0E0] transition-colors"
          >
            Skip Setup
          </button>
        </header>

        {/* Content area - Enter key submits / continues */}
        <main
          className={`flex-1 min-h-0 flex items-start justify-center px-8 py-6 overflow-y-auto transition-all duration-300 ${
            isAnimating ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'
          }`}
          onKeyDown={handleEnterKey}
          tabIndex={0}
        >
          {renderPhase()}
        </main>

        {/* Footer */}
        <footer className="px-8 py-4 text-center">
          <p className="text-xs text-[#505050]">
            Drag header to move window • Use arrow keys to navigate • Enter to confirm • Escape to skip
          </p>
        </footer>
      </div>

      {/* Achievement toast */}
      {showAchievement && (
        <AchievementToast
          achievement={showAchievement}
          onClose={() => setShowAchievement(null)}
        />
      )}

      {/* Global styles for animations */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-float { animation: float 3s ease-in-out infinite; }
        .animate-bounce-slow { animation: bounce-slow 2s ease-in-out infinite; }
        .animate-slide-up { animation: slide-up 0.3s ease-out; }
      `}</style>
    </div>
  );
}
