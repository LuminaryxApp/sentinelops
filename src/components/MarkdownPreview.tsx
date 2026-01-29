import { useMemo } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface MarkdownPreviewProps {
  content: string;
  onClose: () => void;
}

export default function MarkdownPreview({ content, onClose }: MarkdownPreviewProps) {
  // Simple markdown to HTML converter
  const html = useMemo(() => {
    let result = content;

    // Escape HTML first
    result = result
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Code blocks (must be before inline code)
    result = result.replace(
      /```(\w+)?\n([\s\S]*?)```/g,
      '<pre class="code-block"><code class="language-$1">$2</code></pre>'
    );

    // Inline code
    result = result.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

    // Headers
    result = result.replace(/^######\s+(.+)$/gm, '<h6>$1</h6>');
    result = result.replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>');
    result = result.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>');
    result = result.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
    result = result.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
    result = result.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');

    // Bold and italic
    result = result.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    result = result.replace(/\*(.+?)\*/g, '<em>$1</em>');
    result = result.replace(/___(.+?)___/g, '<strong><em>$1</em></strong>');
    result = result.replace(/__(.+?)__/g, '<strong>$1</strong>');
    result = result.replace(/_(.+?)_/g, '<em>$1</em>');

    // Strikethrough
    result = result.replace(/~~(.+?)~~/g, '<del>$1</del>');

    // Links
    result = result.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener">$1</a>'
    );

    // Images
    result = result.replace(
      /!\[([^\]]*)\]\(([^)]+)\)/g,
      '<img src="$2" alt="$1" class="md-image" />'
    );

    // Horizontal rule
    result = result.replace(/^(-{3,}|\*{3,}|_{3,})$/gm, '<hr />');

    // Blockquotes
    result = result.replace(/^>\s+(.+)$/gm, '<blockquote>$1</blockquote>');

    // Unordered lists
    result = result.replace(/^[-*+]\s+(.+)$/gm, '<li>$1</li>');
    result = result.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

    // Ordered lists
    result = result.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');

    // Task lists
    result = result.replace(
      /<li>\[x\]\s*(.+)<\/li>/gi,
      '<li class="task checked"><input type="checkbox" checked disabled /> $1</li>'
    );
    result = result.replace(
      /<li>\[\s?\]\s*(.+)<\/li>/g,
      '<li class="task"><input type="checkbox" disabled /> $1</li>'
    );

    // Tables (basic support)
    const tableRegex = /^\|(.+)\|$/gm;
    result = result.replace(tableRegex, (_match, content) => {
      const cells = content.split('|').map((c: string) => c.trim());
      const isHeader = cells.every((c: string) => /^-+$/.test(c));
      if (isHeader) return '';
      const cellTag = 'td';
      const cellsHtml = cells.map((c: string) => `<${cellTag}>${c}</${cellTag}>`).join('');
      return `<tr>${cellsHtml}</tr>`;
    });
    result = result.replace(/(<tr>.*<\/tr>\n?)+/g, '<table>$&</table>');

    // Line breaks / paragraphs
    result = result.replace(/\n\n+/g, '</p><p>');
    result = result.replace(/\n/g, '<br />');
    result = `<p>${result}</p>`;

    // Clean up empty paragraphs
    result = result.replace(/<p><\/p>/g, '');
    result = result.replace(/<p>(<h[1-6]>)/g, '$1');
    result = result.replace(/(<\/h[1-6]>)<\/p>/g, '$1');
    result = result.replace(/<p>(<pre)/g, '$1');
    result = result.replace(/(<\/pre>)<\/p>/g, '$1');
    result = result.replace(/<p>(<ul>)/g, '$1');
    result = result.replace(/(<\/ul>)<\/p>/g, '$1');
    result = result.replace(/<p>(<table>)/g, '$1');
    result = result.replace(/(<\/table>)<\/p>/g, '$1');
    result = result.replace(/<p>(<hr \/>)/g, '$1');
    result = result.replace(/(<hr \/>)<\/p>/g, '$1');
    result = result.replace(/<p>(<blockquote>)/g, '$1');
    result = result.replace(/(<\/blockquote>)<\/p>/g, '$1');

    return result;
  }, [content]);

  return (
    <div className="h-full flex flex-col bg-[#1E1E1E]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#252526] border-b border-[#3E3E42]">
        <div className="flex items-center gap-2 text-sm text-[#858585]">
          <Eye className="h-4 w-4" />
          <span>Markdown Preview</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-[#3E3E42] rounded"
          title="Close preview"
        >
          <EyeOff className="h-4 w-4 text-[#858585]" />
        </button>
      </div>

      {/* Preview content */}
      <div className="flex-1 overflow-auto p-6">
        <div
          className="markdown-preview max-w-4xl mx-auto"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>

      <style>{`
        .markdown-preview {
          color: #D4D4D4;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 14px;
          line-height: 1.6;
        }
        .markdown-preview h1 {
          font-size: 2em;
          font-weight: 600;
          margin: 1em 0 0.5em;
          padding-bottom: 0.3em;
          border-bottom: 1px solid #3E3E42;
          color: #FFFFFF;
        }
        .markdown-preview h2 {
          font-size: 1.5em;
          font-weight: 600;
          margin: 1em 0 0.5em;
          padding-bottom: 0.3em;
          border-bottom: 1px solid #3E3E42;
          color: #FFFFFF;
        }
        .markdown-preview h3 {
          font-size: 1.25em;
          font-weight: 600;
          margin: 1em 0 0.5em;
          color: #FFFFFF;
        }
        .markdown-preview h4, .markdown-preview h5, .markdown-preview h6 {
          font-size: 1em;
          font-weight: 600;
          margin: 1em 0 0.5em;
          color: #FFFFFF;
        }
        .markdown-preview p {
          margin: 0.5em 0;
        }
        .markdown-preview a {
          color: #3B78FF;
          text-decoration: none;
        }
        .markdown-preview a:hover {
          text-decoration: underline;
        }
        .markdown-preview code.inline-code {
          background: #3C3C3C;
          padding: 0.2em 0.4em;
          border-radius: 3px;
          font-family: 'Consolas', 'Monaco', monospace;
          font-size: 0.9em;
        }
        .markdown-preview pre.code-block {
          background: #1E1E1E;
          border: 1px solid #3E3E42;
          border-radius: 6px;
          padding: 1em;
          overflow-x: auto;
          margin: 1em 0;
        }
        .markdown-preview pre.code-block code {
          font-family: 'Consolas', 'Monaco', monospace;
          font-size: 0.9em;
          color: #D4D4D4;
        }
        .markdown-preview blockquote {
          border-left: 4px solid #3E3E42;
          padding-left: 1em;
          margin: 1em 0;
          color: #858585;
        }
        .markdown-preview ul, .markdown-preview ol {
          padding-left: 2em;
          margin: 0.5em 0;
        }
        .markdown-preview li {
          margin: 0.25em 0;
        }
        .markdown-preview li.task {
          list-style: none;
          margin-left: -1.5em;
        }
        .markdown-preview li.task input {
          margin-right: 0.5em;
        }
        .markdown-preview hr {
          border: none;
          border-top: 1px solid #3E3E42;
          margin: 1.5em 0;
        }
        .markdown-preview table {
          border-collapse: collapse;
          width: 100%;
          margin: 1em 0;
        }
        .markdown-preview th, .markdown-preview td {
          border: 1px solid #3E3E42;
          padding: 0.5em 1em;
          text-align: left;
        }
        .markdown-preview th {
          background: #2D2D2D;
          font-weight: 600;
        }
        .markdown-preview img.md-image {
          max-width: 100%;
          margin: 1em 0;
          border-radius: 4px;
        }
        .markdown-preview del {
          color: #858585;
        }
        .markdown-preview strong {
          color: #FFFFFF;
          font-weight: 600;
        }
      `}</style>
    </div>
  );
}
