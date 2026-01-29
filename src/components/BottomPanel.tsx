import { useState, useEffect, useRef } from 'react';
import { api, ShellInfo } from '../services/api';
import { Terminal as TerminalIcon, X, Plus, AlertCircle, ChevronDown } from 'lucide-react';

interface TerminalInstance {
  id: string;
  output: string;
  isRunning: boolean;
  shellName: string;
  shellPath: string;
}

export default function BottomPanel() {
  const [activeTab, setActiveTab] = useState<'terminal' | 'problems' | 'output'>('terminal');
  const [terminals, setTerminals] = useState<TerminalInstance[]>([]);
  const [activeTerminal, setActiveTerminal] = useState<string | null>(null);
  const [command, setCommand] = useState('');
  const outputRef = useRef<HTMLDivElement>(null);

  // Shell selector state
  const [availableShells, setAvailableShells] = useState<ShellInfo[]>([]);
  const [showShellMenu, setShowShellMenu] = useState(false);
  const shellMenuRef = useRef<HTMLDivElement>(null);

  // Load available shells on mount
  useEffect(() => {
    const loadShells = async () => {
      const res = await api.listAvailableShells();
      if (res.ok && res.data) {
        setAvailableShells(res.data.shells);
      }
    };
    loadShells();
  }, []);

  // Close shell menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (shellMenuRef.current && !shellMenuRef.current.contains(e.target as Node)) {
        setShowShellMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Create a new terminal with selected shell
  const createTerminal = async (shell?: ShellInfo) => {
    const id = `term-${Date.now()}`;
    const shellName = shell?.name || 'Terminal';
    const shellPath = shell?.path || '';
    setTerminals((prev) => [...prev, { id, output: '', isRunning: false, shellName, shellPath }]);
    setActiveTerminal(id);
    setShowShellMenu(false);
  };

  // Execute command
  const executeCommand = async () => {
    if (!command.trim() || !activeTerminal) return;

    const currentCommand = command;
    setCommand('');

    const currentTerm = terminals.find(t => t.id === activeTerminal);

    // Add command to output
    setTerminals((prev) =>
      prev.map((t) =>
        t.id === activeTerminal
          ? { ...t, output: t.output + `$ ${currentCommand}\n`, isRunning: true }
          : t
      )
    );

    try {
      const result = await api.terminalExecute(currentCommand, {
        terminalId: activeTerminal,
        shell: currentTerm?.shellPath || undefined,
      });

      if (result.ok && result.data) {
        // Poll for output
        pollOutput(result.data.terminalId);
      } else {
        setTerminals((prev) =>
          prev.map((t) =>
            t.id === activeTerminal
              ? {
                  ...t,
                  output: t.output + `Error: ${result.error?.message}\n`,
                  isRunning: false,
                }
              : t
          )
        );
      }
    } catch (error) {
      setTerminals((prev) =>
        prev.map((t) =>
          t.id === activeTerminal
            ? {
                ...t,
                output:
                  t.output + `Error: ${error instanceof Error ? error.message : 'Unknown error'}\n`,
                isRunning: false,
              }
            : t
        )
      );
    }
  };

  // Poll for command output
  const pollOutput = async (terminalId: string) => {
    const poll = async () => {
      try {
        const result = await api.terminalOutput(terminalId);
        if (result.ok && result.data) {
          setTerminals((prev) =>
            prev.map((t) =>
              t.id === terminalId
                ? { ...t, output: result.data!.output, isRunning: result.data!.isRunning }
                : t
            )
          );

          if (result.data.isRunning) {
            setTimeout(poll, 500);
          }
        }
      } catch (error) {
        console.error('Failed to poll output:', error);
      }
    };

    poll();
  };

  // Close terminal
  const closeTerminal = (id: string) => {
    setTerminals((prev) => prev.filter((t) => t.id !== id));
    if (activeTerminal === id) {
      setActiveTerminal(terminals[0]?.id || null);
    }
  };

  // Track if initial terminal was created
  const initialTerminalCreated = useRef(false);

  // Create initial terminal after shells are loaded (only once)
  useEffect(() => {
    if (!initialTerminalCreated.current && availableShells.length > 0) {
      initialTerminalCreated.current = true;
      createTerminal(availableShells[0]);
    }
  }, [availableShells]);

  // Auto-scroll output
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [terminals, activeTerminal]);

  const currentTerminal = terminals.find((t) => t.id === activeTerminal);

  return (
    <div className="h-full flex flex-col bg-[#1E1E1E] border-t border-[#3E3E42]">
      {/* Tabs */}
      <div className="flex items-center bg-[#252526] border-b border-[#3E3E42]">
        <button
          onClick={() => setActiveTab('terminal')}
          className={`px-4 py-1.5 text-xs uppercase tracking-wider ${
            activeTab === 'terminal'
              ? 'text-white border-b-2 border-[#007ACC]'
              : 'text-[#858585] hover:text-white'
          }`}
        >
          Terminal
        </button>
        <button
          onClick={() => setActiveTab('problems')}
          className={`px-4 py-1.5 text-xs uppercase tracking-wider ${
            activeTab === 'problems'
              ? 'text-white border-b-2 border-[#007ACC]'
              : 'text-[#858585] hover:text-white'
          }`}
        >
          Problems
        </button>
        <button
          onClick={() => setActiveTab('output')}
          className={`px-4 py-1.5 text-xs uppercase tracking-wider ${
            activeTab === 'output'
              ? 'text-white border-b-2 border-[#007ACC]'
              : 'text-[#858585] hover:text-white'
          }`}
        >
          Output
        </button>

        <div className="flex-1" />

        {/* Terminal tabs */}
        {activeTab === 'terminal' && (
          <div className="flex items-center gap-1 px-2">
            {terminals.map((term) => (
              <div
                key={term.id}
                onClick={() => setActiveTerminal(term.id)}
                className={`flex items-center gap-1 px-2 py-1 text-xs rounded cursor-pointer ${
                  activeTerminal === term.id
                    ? 'bg-[#37373D] text-white'
                    : 'text-[#858585] hover:bg-[#2A2D2E]'
                }`}
              >
                <TerminalIcon size={12} />
                <span>{term.shellName}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTerminal(term.id);
                  }}
                  className="ml-1 hover:bg-[#3E3E42] rounded p-0.5"
                >
                  <X size={10} />
                </button>
              </div>
            ))}

            {/* Shell selector dropdown */}
            <div className="relative" ref={shellMenuRef}>
              <button
                onClick={() => setShowShellMenu(!showShellMenu)}
                className="flex items-center gap-0.5 p-1 text-[#858585] hover:text-white hover:bg-[#3E3E42] rounded"
                title="New Terminal"
              >
                <Plus size={14} />
                <ChevronDown size={10} />
              </button>

              {showShellMenu && (
                <div className="absolute right-0 top-full mt-1 bg-[#252526] border border-[#3E3E42] rounded-lg shadow-xl z-50 min-w-[200px] py-1">
                  <div className="px-3 py-1.5 text-xs text-[#858585] border-b border-[#3E3E42]">
                    Select Shell
                  </div>
                  {availableShells.map((shell) => (
                    <button
                      key={shell.id}
                      onClick={() => createTerminal(shell)}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-[#37373D] flex items-center gap-2"
                    >
                      <TerminalIcon size={14} className="text-[#858585]" />
                      <div>
                        <div className="text-[#D4D4D4]">{shell.name}</div>
                        <div className="text-xs text-[#858585]">{shell.path}</div>
                      </div>
                    </button>
                  ))}
                  {availableShells.length === 0 && (
                    <div className="px-3 py-2 text-sm text-[#858585]">
                      No shells detected
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'terminal' && currentTerminal && (
          <div className="h-full flex flex-col">
            {/* Output */}
            <div
              ref={outputRef}
              className="flex-1 p-2 overflow-y-auto font-mono text-sm text-[#CCCCCC] whitespace-pre-wrap"
            >
              {currentTerminal.output || '$ '}
            </div>

            {/* Input */}
            <div className="flex items-center gap-2 px-2 py-1 border-t border-[#3E3E42]">
              <span className="text-[#858585]">$</span>
              <input
                type="text"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    executeCommand();
                  }
                }}
                disabled={currentTerminal.isRunning}
                placeholder="Enter command..."
                className="flex-1 bg-transparent border-none outline-none font-mono text-sm text-[#CCCCCC] placeholder-[#606060]"
              />
              {currentTerminal.isRunning && (
                <span className="text-xs text-[#858585]">Running...</span>
              )}
            </div>
          </div>
        )}

        {activeTab === 'problems' && (
          <div className="h-full flex items-center justify-center text-[#858585]">
            <div className="text-center">
              <AlertCircle size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">No problems detected</p>
            </div>
          </div>
        )}

        {activeTab === 'output' && (
          <div className="h-full flex items-center justify-center text-[#858585]">
            <p className="text-sm">No output</p>
          </div>
        )}
      </div>
    </div>
  );
}
