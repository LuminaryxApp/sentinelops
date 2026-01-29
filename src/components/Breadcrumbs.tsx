import { useMemo } from 'react';
import { ChevronRight, File, Folder } from 'lucide-react';

interface BreadcrumbsProps {
  path: string;
  workspaceRoot?: string;
  currentSymbol?: string;
  onNavigateToPath?: (path: string) => void;
  onNavigateToSymbol?: () => void;
}

export default function Breadcrumbs({
  path,
  workspaceRoot,
  currentSymbol,
  onNavigateToPath,
  onNavigateToSymbol,
}: BreadcrumbsProps) {
  const parts = useMemo(() => {
    // Remove workspace root from path for cleaner display
    let displayPath = path;
    if (workspaceRoot && path.startsWith(workspaceRoot)) {
      displayPath = path.slice(workspaceRoot.length).replace(/^[/\\]/, '');
    }

    // Split path into parts
    const segments = displayPath.split(/[/\\]/).filter(Boolean);

    // Build paths for each segment
    const result: { name: string; path: string; isFile: boolean }[] = [];
    let currentPath = workspaceRoot || '';

    segments.forEach((segment, index) => {
      currentPath = currentPath ? `${currentPath}/${segment}` : segment;
      result.push({
        name: segment,
        path: currentPath,
        isFile: index === segments.length - 1,
      });
    });

    return result;
  }, [path, workspaceRoot]);

  if (parts.length === 0) return null;

  return (
    <div className="flex items-center gap-1 px-3 py-1 bg-[#252526] border-b border-[#3E3E42] text-xs overflow-x-auto">
      {parts.map((part, index) => (
        <div key={part.path} className="flex items-center gap-1 flex-shrink-0">
          {index > 0 && (
            <ChevronRight className="h-3 w-3 text-[#858585]" />
          )}
          <button
            onClick={() => onNavigateToPath?.(part.path)}
            className="flex items-center gap-1 px-1 py-0.5 rounded hover:bg-[#3E3E42] text-[#CCCCCC]"
          >
            {part.isFile ? (
              <File className="h-3 w-3 text-[#858585]" />
            ) : (
              <Folder className="h-3 w-3 text-[#DCAD5A]" />
            )}
            <span>{part.name}</span>
          </button>
        </div>
      ))}

      {/* Current symbol */}
      {currentSymbol && (
        <>
          <ChevronRight className="h-3 w-3 text-[#858585] flex-shrink-0" />
          <button
            onClick={onNavigateToSymbol}
            className="flex items-center gap-1 px-1 py-0.5 rounded hover:bg-[#3E3E42] text-[#DCDCAA] flex-shrink-0"
          >
            <span>{currentSymbol}</span>
          </button>
        </>
      )}
    </div>
  );
}
