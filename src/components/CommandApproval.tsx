import { Check, X, Terminal, AlertTriangle, Loader2 } from 'lucide-react';
import type { PendingCommand } from '../hooks/useStore';

interface CommandApprovalProps {
  command: PendingCommand;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

export function CommandApproval({ command, onApprove, onReject }: CommandApprovalProps) {
  const isExecuting = command.status === 'executing';
  const isCompleted = command.status === 'completed';
  const isRejected = command.status === 'rejected';

  return (
    <div className={`
      rounded-lg p-4 my-3 border
      ${isRejected
        ? 'bg-[#2D2020] border-[#6B3030]'
        : isCompleted
          ? 'bg-[#1E2D1E] border-[#306B30]'
          : 'bg-[#2D2D30] border-[#F48771]'
      }
    `}>
      <div className="flex items-center gap-2 mb-2">
        {isExecuting ? (
          <Loader2 className="h-5 w-5 text-[#569CD6] animate-spin" />
        ) : isCompleted ? (
          <Check className="h-5 w-5 text-[#4EC9B0]" />
        ) : isRejected ? (
          <X className="h-5 w-5 text-[#F14C4C]" />
        ) : (
          <AlertTriangle className="h-5 w-5 text-[#F48771]" />
        )}
        <span className={`font-medium ${
          isRejected
            ? 'text-[#F14C4C]'
            : isCompleted
              ? 'text-[#4EC9B0]'
              : 'text-[#F48771]'
        }`}>
          {isExecuting
            ? 'Executing Command...'
            : isCompleted
              ? 'Command Completed'
              : isRejected
                ? 'Command Rejected'
                : 'Command Approval Required'
          }
        </span>
      </div>

      {command.reason && (
        <p className="text-sm text-[#858585] mb-2 flex items-center gap-1">
          <Terminal className="h-3 w-3" />
          {command.reason}
        </p>
      )}

      <div className="bg-[#1E1E1E] p-3 rounded font-mono text-sm mb-3 overflow-x-auto">
        <span className="text-[#858585]">$ </span>
        <span className="text-[#DCDCAA]">{command.command}</span>
      </div>

      {command.workingDirectory && command.workingDirectory !== '.' && (
        <p className="text-xs text-[#858585] mb-2">
          Working directory: <span className="text-[#569CD6]">{command.workingDirectory}</span>
        </p>
      )}

      {command.result && (
        <div className="bg-[#1E1E1E] p-3 rounded font-mono text-xs mb-3 max-h-48 overflow-auto">
          <pre className="text-[#D4D4D4] whitespace-pre-wrap">{command.result}</pre>
        </div>
      )}

      {command.error && (
        <div className="bg-[#2D2020] p-3 rounded font-mono text-xs mb-3">
          <pre className="text-[#F14C4C] whitespace-pre-wrap">{command.error}</pre>
        </div>
      )}

      {command.status === 'pending' && (
        <div className="flex gap-2">
          <button
            onClick={() => onApprove(command.id)}
            className="flex items-center gap-1 px-3 py-1.5 bg-[#0E639C] hover:bg-[#1177BB] text-white rounded text-sm font-medium transition-colors"
          >
            <Check className="h-4 w-4" />
            Approve & Run
          </button>
          <button
            onClick={() => onReject(command.id)}
            className="flex items-center gap-1 px-3 py-1.5 bg-[#3E3E42] hover:bg-[#4E4E52] text-[#CCCCCC] rounded text-sm transition-colors"
          >
            <X className="h-4 w-4" />
            Reject
          </button>
        </div>
      )}
    </div>
  );
}

export default CommandApproval;
