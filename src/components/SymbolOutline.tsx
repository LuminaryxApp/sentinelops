import { useMemo, useState } from 'react';
import {
  Code,
  Hash,
  Box,
  Braces,
  Type,
  Variable,
  ChevronRight,
  ChevronDown,
  X,
} from 'lucide-react';

interface Symbol {
  name: string;
  kind: 'function' | 'class' | 'interface' | 'type' | 'variable' | 'constant' | 'method' | 'property' | 'enum';
  line: number;
  children?: Symbol[];
}

interface SymbolOutlineProps {
  content: string;
  language: string;
  onNavigate: (line: number) => void;
  onClose: () => void;
}

export default function SymbolOutline({ content, language, onNavigate, onClose }: SymbolOutlineProps) {
  const [expandedSymbols, setExpandedSymbols] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState('');

  const symbols = useMemo(() => {
    const lines = content.split('\n');
    const result: Symbol[] = [];

    // Different parsing based on language
    const isJS = ['javascript', 'typescript', 'jsx', 'tsx'].includes(language);
    const isPython = language === 'python';
    const isRust = language === 'rust';
    const isGo = language === 'go';
    const isCpp = ['c', 'cpp', 'csharp', 'java'].includes(language);

    lines.forEach((line, index) => {
      const lineNum = index + 1;
      const trimmed = line.trim();

      if (isJS) {
        // Functions
        const funcMatch = trimmed.match(/^(?:export\s+)?(?:async\s+)?function\s+(\w+)/);
        if (funcMatch) {
          result.push({ name: funcMatch[1], kind: 'function', line: lineNum });
        }

        // Arrow functions (const name = ...)
        const arrowMatch = trimmed.match(/^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(/);
        if (arrowMatch) {
          result.push({ name: arrowMatch[1], kind: 'function', line: lineNum });
        }

        // Classes
        const classMatch = trimmed.match(/^(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/);
        if (classMatch) {
          result.push({ name: classMatch[1], kind: 'class', line: lineNum });
        }

        // Interfaces
        const interfaceMatch = trimmed.match(/^(?:export\s+)?interface\s+(\w+)/);
        if (interfaceMatch) {
          result.push({ name: interfaceMatch[1], kind: 'interface', line: lineNum });
        }

        // Type aliases
        const typeMatch = trimmed.match(/^(?:export\s+)?type\s+(\w+)/);
        if (typeMatch) {
          result.push({ name: typeMatch[1], kind: 'type', line: lineNum });
        }

        // Enums
        const enumMatch = trimmed.match(/^(?:export\s+)?enum\s+(\w+)/);
        if (enumMatch) {
          result.push({ name: enumMatch[1], kind: 'enum', line: lineNum });
        }
      }

      if (isPython) {
        // Functions
        const funcMatch = trimmed.match(/^(?:async\s+)?def\s+(\w+)/);
        if (funcMatch) {
          result.push({ name: funcMatch[1], kind: 'function', line: lineNum });
        }

        // Classes
        const classMatch = trimmed.match(/^class\s+(\w+)/);
        if (classMatch) {
          result.push({ name: classMatch[1], kind: 'class', line: lineNum });
        }
      }

      if (isRust) {
        // Functions
        const funcMatch = trimmed.match(/^(?:pub\s+)?(?:async\s+)?fn\s+(\w+)/);
        if (funcMatch) {
          result.push({ name: funcMatch[1], kind: 'function', line: lineNum });
        }

        // Structs
        const structMatch = trimmed.match(/^(?:pub\s+)?struct\s+(\w+)/);
        if (structMatch) {
          result.push({ name: structMatch[1], kind: 'class', line: lineNum });
        }

        // Enums
        const enumMatch = trimmed.match(/^(?:pub\s+)?enum\s+(\w+)/);
        if (enumMatch) {
          result.push({ name: enumMatch[1], kind: 'enum', line: lineNum });
        }

        // Traits
        const traitMatch = trimmed.match(/^(?:pub\s+)?trait\s+(\w+)/);
        if (traitMatch) {
          result.push({ name: traitMatch[1], kind: 'interface', line: lineNum });
        }

        // Impl blocks
        const implMatch = trimmed.match(/^impl(?:<[^>]+>)?\s+(\w+)/);
        if (implMatch) {
          result.push({ name: `impl ${implMatch[1]}`, kind: 'class', line: lineNum });
        }
      }

      if (isGo) {
        // Functions
        const funcMatch = trimmed.match(/^func\s+(?:\([^)]+\)\s+)?(\w+)/);
        if (funcMatch) {
          result.push({ name: funcMatch[1], kind: 'function', line: lineNum });
        }

        // Types (structs, interfaces)
        const typeMatch = trimmed.match(/^type\s+(\w+)\s+(struct|interface)/);
        if (typeMatch) {
          result.push({
            name: typeMatch[1],
            kind: typeMatch[2] === 'interface' ? 'interface' : 'class',
            line: lineNum,
          });
        }
      }

      if (isCpp) {
        // Functions
        const funcMatch = trimmed.match(/^(?:(?:public|private|protected|static|virtual|inline|const):\s*)*(?:\w+\s+)+(\w+)\s*\(/);
        if (funcMatch && !['if', 'while', 'for', 'switch', 'catch'].includes(funcMatch[1])) {
          result.push({ name: funcMatch[1], kind: 'function', line: lineNum });
        }

        // Classes
        const classMatch = trimmed.match(/^(?:public\s+)?class\s+(\w+)/);
        if (classMatch) {
          result.push({ name: classMatch[1], kind: 'class', line: lineNum });
        }

        // Structs
        const structMatch = trimmed.match(/^struct\s+(\w+)/);
        if (structMatch) {
          result.push({ name: structMatch[1], kind: 'class', line: lineNum });
        }

        // Interfaces (C#)
        const interfaceMatch = trimmed.match(/^(?:public\s+)?interface\s+(\w+)/);
        if (interfaceMatch) {
          result.push({ name: interfaceMatch[1], kind: 'interface', line: lineNum });
        }
      }

      // Markdown headers
      if (language === 'markdown') {
        const headerMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
        if (headerMatch) {
          result.push({
            name: headerMatch[2],
            kind: 'type',
            line: lineNum,
          });
        }
      }
    });

    return result;
  }, [content, language]);

  // Filter symbols
  const filteredSymbols = symbols.filter((s) =>
    s.name.toLowerCase().includes(filter.toLowerCase())
  );

  const toggleExpand = (name: string) => {
    setExpandedSymbols((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const getIcon = (kind: Symbol['kind']) => {
    switch (kind) {
      case 'function':
      case 'method':
        return <Code className="h-4 w-4 text-[#DCDCAA]" />;
      case 'class':
        return <Box className="h-4 w-4 text-[#4EC9B0]" />;
      case 'interface':
        return <Braces className="h-4 w-4 text-[#4EC9B0]" />;
      case 'type':
        return <Type className="h-4 w-4 text-[#4EC9B0]" />;
      case 'variable':
      case 'property':
        return <Variable className="h-4 w-4 text-[#9CDCFE]" />;
      case 'constant':
        return <Hash className="h-4 w-4 text-[#4FC1FF]" />;
      case 'enum':
        return <Braces className="h-4 w-4 text-[#CE9178]" />;
      default:
        return <Code className="h-4 w-4 text-[#858585]" />;
    }
  };

  const renderSymbol = (symbol: Symbol, depth = 0) => {
    const hasChildren = symbol.children && symbol.children.length > 0;
    const isExpanded = expandedSymbols.has(symbol.name);

    return (
      <div key={`${symbol.name}-${symbol.line}`}>
        <button
          onClick={() => {
            if (hasChildren) {
              toggleExpand(symbol.name);
            } else {
              onNavigate(symbol.line);
            }
          }}
          className="w-full flex items-center gap-1 px-2 py-1 text-left text-sm hover:bg-[#2A2D2E] rounded"
          style={{ paddingLeft: `${8 + depth * 12}px` }}
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown className="h-3 w-3 text-[#858585]" />
            ) : (
              <ChevronRight className="h-3 w-3 text-[#858585]" />
            )
          ) : (
            <span className="w-3" />
          )}
          {getIcon(symbol.kind)}
          <span className="text-[#CCCCCC] truncate flex-1">{symbol.name}</span>
          <span className="text-[#858585] text-xs">{symbol.line}</span>
        </button>
        {hasChildren && isExpanded && (
          <div>
            {symbol.children!.map((child) => renderSymbol(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-[#252526] border-l border-[#3E3E42]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#3E3E42]">
        <span className="text-xs font-medium text-[#CCCCCC] uppercase">Outline</span>
        <button
          onClick={onClose}
          className="p-1 hover:bg-[#3E3E42] rounded"
          title="Close outline"
        >
          <X className="h-3 w-3 text-[#858585]" />
        </button>
      </div>

      {/* Filter */}
      <div className="px-2 py-1 border-b border-[#3E3E42]">
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter symbols..."
          className="w-full px-2 py-1 text-xs bg-[#3C3C3C] border border-[#3E3E42] rounded text-[#CCCCCC] placeholder-[#858585] focus:border-[#007ACC] focus:outline-none"
        />
      </div>

      {/* Symbols list */}
      <div className="flex-1 overflow-y-auto py-1">
        {filteredSymbols.length === 0 ? (
          <div className="px-3 py-4 text-center text-xs text-[#858585]">
            {filter ? 'No matching symbols' : 'No symbols found'}
          </div>
        ) : (
          filteredSymbols.map((symbol) => renderSymbol(symbol))
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-1 border-t border-[#3E3E42] text-xs text-[#858585]">
        {filteredSymbols.length} symbols
      </div>
    </div>
  );
}
