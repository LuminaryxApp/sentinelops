import { useState, useEffect } from 'react';
import { GitBranch, RefreshCw, Plus, X, Check, Eye } from 'lucide-react';
import { useStore, getLanguageFromFilename } from '../hooks/useStore';
import { api } from '../services/api';

export default function GitPanel() {
  const {
    gitBranch,
    gitChanges,
    isLoadingGit,
    setGitLoading,
    setGitData,
    addNotification,
    openFile,
    setActiveTab,
  } = useStore();

  const [commitMessage, setCommitMessage] = useState('');
  const [viewingDiff, setViewingDiff] = useState<string | null>(null);
  const [diffContent, setDiffContent] = useState<string>('');

  // Fetch Git status
  useEffect(() => {
    fetchGitStatus();
  }, []);

  const fetchGitStatus = async () => {
    setGitLoading(true);
    try {
      const response = await api.gitStatus();
      if (response.ok && response.data) {
        setGitData(response.data.branch, response.data.changes);
      }
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Failed to fetch Git status',
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setGitLoading(false);
    }
  };

  const stagedFiles = gitChanges.filter((c) => c.staged);
  const unstagedFiles = gitChanges.filter((c) => !c.staged);

  const handleStage = async (path: string) => {
    try {
      const response = await api.gitStage([path]);
      if (response.ok) {
        addNotification({ type: 'success', title: 'File staged', message: path });
        fetchGitStatus();
      } else {
        addNotification({
          type: 'error',
          title: 'Failed to stage file',
          message: response.error?.message || 'Unknown error',
        });
      }
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Failed to stage file',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const handleUnstage = async (path: string) => {
    try {
      const response = await api.gitUnstage([path]);
      if (response.ok) {
        addNotification({ type: 'success', title: 'File unstaged', message: path });
        fetchGitStatus();
      } else {
        addNotification({
          type: 'error',
          title: 'Failed to unstage file',
          message: response.error?.message || 'Unknown error',
        });
      }
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Failed to unstage file',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const handleCommit = async () => {
    if (!commitMessage.trim()) {
      addNotification({ type: 'warning', title: 'Commit message required', message: '' });
      return;
    }
    try {
      const response = await api.gitCommit(commitMessage);
      if (response.ok) {
        addNotification({ type: 'success', title: 'Committed', message: commitMessage });
        setCommitMessage('');
        fetchGitStatus();
      } else {
        addNotification({
          type: 'error',
          title: 'Failed to commit',
          message: response.error?.message || 'Unknown error',
        });
      }
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Failed to commit',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const handleViewDiff = async (path: string) => {
    try {
      const response = await api.gitDiff(path);
      if (response.ok && response.data) {
        setDiffContent(response.data.diff);
        setViewingDiff(path);
      }
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Failed to load diff',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const openFileInEditor = async (path: string) => {
    try {
      const response = await api.read(path);
      if (response.ok && response.data) {
        const filename = path.split(/[/\\]/).pop() || path;
        openFile({
          path,
          name: filename,
          content: response.data.content,
          originalContent: response.data.content,
          language: getLanguageFromFilename(filename),
          isDirty: false,
        });
        setActiveTab('files');
      }
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Failed to open file',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const statusColors: Record<string, string> = {
    modified: 'text-[#E2C08D]',
    added: 'text-[#89D185]',
    deleted: 'text-[#F48771]',
    renamed: 'text-[#4EC9B0]',
    untracked: 'text-[#73C991]',
  };

  return (
    <div className="flex h-full flex-col bg-[#252526]">
      {/* Header */}
      <div className="panel-header">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-[#007ACC]" />
          <span>Source Control</span>
          {gitBranch && <span className="text-[#858585]">({gitBranch})</span>}
        </div>
        <button
          onClick={fetchGitStatus}
          className="p-1 hover:bg-[#3E3E42] rounded"
          title="Refresh"
        >
          <RefreshCw className={`h-4 w-4 ${isLoadingGit ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoadingGit ? (
          <div className="flex h-48 items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin text-[#007ACC]" />
          </div>
        ) : (
          <>
            {/* Staged changes */}
            {stagedFiles.length > 0 && (
              <div className="border-b border-[#3E3E42]">
                <div className="px-3 py-2 text-xs font-semibold text-[#007ACC] uppercase">
                  Staged Changes
                </div>
                {stagedFiles.map((change) => (
                  <div
                    key={change.path}
                    className="flex items-center justify-between px-3 py-1 hover:bg-[#2A2D2E] group"
                  >
                    <button
                      onClick={() => openFileInEditor(change.path)}
                      className="flex items-center gap-2 flex-1 text-left text-xs truncate"
                    >
                      <span className={statusColors[change.status]}>
                        {change.status[0].toUpperCase()}
                      </span>
                      <span className="text-[#D4D4D4] truncate">{change.path}</span>
                    </button>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                      <button
                        onClick={() => handleViewDiff(change.path)}
                        className="p-1 hover:bg-[#3E3E42] rounded"
                        title="View diff"
                      >
                        <Eye className="h-3 w-3 text-[#858585]" />
                      </button>
                      <button
                        onClick={() => handleUnstage(change.path)}
                        className="p-1 hover:bg-[#3E3E42] rounded"
                        title="Unstage"
                      >
                        <X className="h-3 w-3 text-[#858585]" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Unstaged changes */}
            {unstagedFiles.length > 0 && (
              <div className="border-b border-[#3E3E42]">
                <div className="px-3 py-2 text-xs font-semibold text-[#DCDCAA] uppercase">
                  Changes
                </div>
                {unstagedFiles.map((change) => (
                  <div
                    key={change.path}
                    className="flex items-center justify-between px-3 py-1 hover:bg-[#2A2D2E] group"
                  >
                    <button
                      onClick={() => openFileInEditor(change.path)}
                      className="flex items-center gap-2 flex-1 text-left text-xs truncate"
                    >
                      <span className={statusColors[change.status]}>
                        {change.status[0].toUpperCase()}
                      </span>
                      <span className="text-[#D4D4D4] truncate">{change.path}</span>
                    </button>
                    <button
                      onClick={() => handleStage(change.path)}
                      className="p-1 hover:bg-[#3E3E42] rounded opacity-0 group-hover:opacity-100"
                      title="Stage"
                    >
                      <Plus className="h-3 w-3 text-[#858585]" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* No changes */}
            {gitChanges.length === 0 && (
              <div className="flex h-48 items-center justify-center text-[#858585]">
                <div className="text-center">
                  <GitBranch className="mx-auto mb-2 h-8 w-8 opacity-50" />
                  <p className="text-sm">No changes</p>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Commit box */}
      {stagedFiles.length > 0 && (
        <div className="p-3 border-t border-[#3E3E42]">
          <input
            type="text"
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            placeholder="Message (Ctrl+Enter to commit)"
            className="input w-full mb-2 text-sm"
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                handleCommit();
              }
            }}
          />
          <button
            onClick={handleCommit}
            disabled={!commitMessage.trim()}
            className="btn btn-primary w-full flex items-center justify-center gap-2"
          >
            <Check className="h-4 w-4" />
            Commit ({stagedFiles.length} file{stagedFiles.length !== 1 ? 's' : ''})
          </button>
        </div>
      )}

      {/* Diff viewer modal */}
      {viewingDiff && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-8">
          <div className="w-full max-w-4xl h-[80vh] bg-[#1E1E1E] border border-[#3E3E42] rounded-lg flex flex-col">
            <div className="flex items-center justify-between px-4 py-2 border-b border-[#3E3E42]">
              <span className="font-medium">{viewingDiff}</span>
              <button
                onClick={() => setViewingDiff(null)}
                className="p-1 hover:bg-[#3E3E42] rounded"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <pre className="flex-1 overflow-auto p-4 font-mono text-sm whitespace-pre-wrap">
              {diffContent || 'No diff available'}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
