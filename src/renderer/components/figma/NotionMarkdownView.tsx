import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Heading1,
  Heading2,
  Heading3,
  CheckSquare,
  List,
  ListOrdered,
  Quote,
  Code2,
  Minus,
  Image as ImageIcon,
  Type,
} from 'lucide-react';

interface NotionMarkdownViewProps {
  content: string;
  onChangeContent?: (nextContent: string) => void;
  onToggleCheckbox?: (lineIndex: number) => void;
  onRequestInsertImage?: (lineIndex: number) => void;
}

interface SlashCommandItem {
  id: string;
  label: string;
  hint: string;
  keywords: string;
  prefix: string;
  isCodeBlock?: boolean;
  isImage?: boolean;
  Icon: React.ComponentType<{ className?: string }>;
}

const SLASH_COMMANDS: SlashCommandItem[] = [
  {
    id: 'todo',
    label: 'Lista de Tarefas',
    hint: '- [ ]',
    keywords: 'tarefa todo checkbox check lista',
    prefix: '- [ ] ',
    Icon: CheckSquare,
  },
  {
    id: 'h1',
    label: 'Título 1',
    hint: '#',
    keywords: 'titulo h1 heading grande',
    prefix: '# ',
    Icon: Heading1,
  },
  {
    id: 'h2',
    label: 'Título 2',
    hint: '##',
    keywords: 'subtitulo h2 heading medio',
    prefix: '## ',
    Icon: Heading2,
  },
  {
    id: 'h3',
    label: 'Título 3',
    hint: '###',
    keywords: 'h3 pequeno titulo',
    prefix: '### ',
    Icon: Heading3,
  },
  {
    id: 'bullet',
    label: 'Lista com Marcadores',
    hint: '-',
    keywords: 'lista bullet pontos marcador',
    prefix: '- ',
    Icon: List,
  },
  {
    id: 'numbered',
    label: 'Lista Numerada',
    hint: '1.',
    keywords: 'lista numerada numeros ordem',
    prefix: '1. ',
    Icon: ListOrdered,
  },
  {
    id: 'quote',
    label: 'Destaque (Callout)',
    hint: '>',
    keywords: 'callout citacao quote destaque',
    prefix: '> ',
    Icon: Quote,
  },
  {
    id: 'code',
    label: 'Bloco de Código',
    hint: '```',
    keywords: 'codigo code snippet',
    prefix: '```',
    isCodeBlock: true,
    Icon: Code2,
  },
  {
    id: 'divider',
    label: 'Divisor Horizontal',
    hint: '---',
    keywords: 'divisor linha separador hr',
    prefix: '---',
    Icon: Minus,
  },
  {
    id: 'image',
    label: 'Imagem',
    hint: '![alt](url)',
    keywords: 'imagem foto picture anexo',
    prefix: '',
    isImage: true,
    Icon: ImageIcon,
  },
  {
    id: 'text',
    label: 'Texto Simples',
    hint: 'Aa',
    keywords: 'texto paragrafo normal',
    prefix: '',
    Icon: Type,
  },
];

function renderInlineMarkdown(text: string): React.ReactNode[] {
  const pattern =
    /(!\[[^\]]*\]\([^)]+\)|\[[^\]]+\]\([^)]+\)|`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|~~[^~]+~~)/g;
  const parts = text.split(pattern);

  return parts.map((part, idx) => {
    if (!part) return null;

    const imgMatch = part.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imgMatch) {
      return (
        <img
          key={idx}
          src={imgMatch[2]}
          alt={imgMatch[1] || 'Imagem'}
          className="my-2 rounded-[10px] max-h-56 w-full object-cover border border-[#E7E5F0] dark:border-white/10"
        />
      );
    }

    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      return (
        <a
          key={idx}
          href={linkMatch[2]}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-[#FB7213] underline underline-offset-2 hover:text-[#E06209]"
        >
          {linkMatch[1]}
        </a>
      );
    }

    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return (
        <code
          key={idx}
          className="px-1.5 py-0.5 rounded-[5px] bg-[#F5F6FA] dark:bg-white/10 text-[#FB7213] font-mono text-[11px] border border-[#E7E5F0] dark:border-white/10"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      return (
        <strong key={idx} className="font-bold text-[#242424] dark:text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }

    if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
      return (
        <em key={idx} className="italic text-[#242424]/90 dark:text-white/90">
          {part.slice(1, -1)}
        </em>
      );
    }

    if (part.startsWith('~~') && part.endsWith('~~') && part.length >= 4) {
      return (
        <del key={idx} className="line-through text-[#6D6D6D] dark:text-white/45">
          {part.slice(2, -2)}
        </del>
      );
    }

    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

type LineKind =
  | { kind: 'h1'; prefix: '# '; text: string }
  | { kind: 'h2'; prefix: '## '; text: string }
  | { kind: 'h3'; prefix: '### '; text: string }
  | { kind: 'todo'; prefix: string; checked: boolean; text: string }
  | { kind: 'ul'; prefix: '- '; text: string }
  | { kind: 'ol'; prefix: string; num: string; text: string }
  | { kind: 'quote'; prefix: '> '; text: string }
  | { kind: 'paragraph'; prefix: ''; text: string };

function parseEditableLine(line: string): LineKind {
  if (line.startsWith('### ')) return { kind: 'h3', prefix: '### ', text: line.slice(4) };
  if (line.startsWith('## ')) return { kind: 'h2', prefix: '## ', text: line.slice(3) };
  if (line.startsWith('# ')) return { kind: 'h1', prefix: '# ', text: line.slice(2) };
  const todo = line.match(/^(\s*-\s+\[([ xX])\]\s+)(.*)$/);
  if (todo) {
    return {
      kind: 'todo',
      prefix: `- [${todo[2].toLowerCase() === 'x' ? 'x' : ' '}] `,
      checked: todo[2].toLowerCase() === 'x',
      text: todo[3],
    };
  }
  const ul = line.match(/^\s*[-*]\s+(.*)$/);
  if (ul) return { kind: 'ul', prefix: '- ', text: ul[1] };
  const ol = line.match(/^\s*(\d+)\.\s+(.*)$/);
  if (ol) return { kind: 'ol', prefix: `${ol[1]}. `, num: ol[1], text: ol[2] };
  if (line.startsWith('> ')) return { kind: 'quote', prefix: '> ', text: line.slice(2) };
  return { kind: 'paragraph', prefix: '', text: line };
}

export const NotionMarkdownView: React.FC<NotionMarkdownViewProps> = ({
  content,
  onChangeContent,
  onToggleCheckbox,
  onRequestInsertImage,
}) => {
  const [focusedIdx, setFocusedIdx] = useState<number | null>(null);
  const [slashQuery, setSlashQuery] = useState<string | null>(null);
  const [slashSelectedIdx, setSlashSelectedIdx] = useState<number>(0);

  const inputRefs = useRef<Map<number, HTMLInputElement | HTMLTextAreaElement>>(new Map());
  const lines = useMemo(() => (content ? content.split('\n') : ['']), [content]);

  const editable = Boolean(onChangeContent);

  const filteredCommands = useMemo(() => {
    if (slashQuery === null) return [];
    const q = slashQuery.trim().toLowerCase();
    if (!q) return SLASH_COMMANDS;
    return SLASH_COMMANDS.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(q) ||
        cmd.keywords.toLowerCase().includes(q) ||
        cmd.hint.toLowerCase().includes(q)
    );
  }, [slashQuery]);

  useEffect(() => {
    setSlashSelectedIdx(0);
  }, [slashQuery]);

  const focusLine = (idx: number) => {
    setFocusedIdx(idx);
    requestAnimationFrame(() => {
      const el = inputRefs.current.get(idx);
      if (el) {
        el.focus();
        const len = el.value.length;
        try {
          el.setSelectionRange(len, len);
        } catch {
          // ignore
        }
      }
    });
  };

  const commitLines = (nextLines: string[]) => {
    onChangeContent?.(nextLines.join('\n'));
  };

  const applySlashCommand = (lineIndex: number, cmd: SlashCommandItem) => {
    setSlashQuery(null);

    if (cmd.isImage) {
      const cleaned = lines.map((l, i) => (i === lineIndex ? '' : l));
      commitLines(cleaned);
      setFocusedIdx(null);
      onRequestInsertImage?.(lineIndex);
      return;
    }

    const next = [...lines];
    if (cmd.isCodeBlock) {
      next.splice(lineIndex, 1, '```ts', '// código aqui', '```');
      commitLines(next);
      focusLine(lineIndex + 1);
      return;
    }

    if (cmd.id === 'divider') {
      next.splice(lineIndex, 1, '---', '');
      commitLines(next);
      focusLine(lineIndex + 1);
      return;
    }

    next[lineIndex] = cmd.prefix;
    commitLines(next);
    focusLine(lineIndex);
  };

  const handleLineBodyChange = (idx: number, rawLine: string, newBody: string) => {
    const parsed = parseEditableLine(rawLine);

    // Check slash command activation when typing / at start or in empty paragraph
    if (parsed.kind === 'paragraph' && newBody.startsWith('/')) {
      setSlashQuery(newBody.slice(1));
    } else if (newBody.startsWith('/') && newBody.length <= 14 && parsed.text === '') {
      setSlashQuery(newBody.slice(1));
    } else {
      setSlashQuery(null);
    }

    // Inline markdown shortcut auto-transform on plain paragraph
    let nextLine = `${parsed.prefix}${newBody}`;
    if (parsed.kind === 'paragraph') {
      if (newBody === '[] ') nextLine = '- [ ] ';
    }

    const next = [...lines];
    next[idx] = nextLine;
    commitLines(next);
  };

  const handleLineKeyDown = (e: React.KeyboardEvent, idx: number, rawLine: string) => {
    if (slashQuery !== null && filteredCommands.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSlashSelectedIdx((i) => (i + 1) % filteredCommands.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashSelectedIdx((i) => (i - 1 + filteredCommands.length) % filteredCommands.length);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        applySlashCommand(idx, filteredCommands[slashSelectedIdx]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setSlashQuery(null);
        return;
      }
    }

    const parsed = parseEditableLine(rawLine);

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      setSlashQuery(null);

      // Pressing Enter on empty bullet/todo exits list formatting
      if (
        (parsed.kind === 'todo' || parsed.kind === 'ul' || parsed.kind === 'ol') &&
        parsed.text.trim() === ''
      ) {
        const next = [...lines];
        next[idx] = '';
        commitLines(next);
        focusLine(idx);
        return;
      }

      let continuation = '';
      if (parsed.kind === 'todo') continuation = '- [ ] ';
      else if (parsed.kind === 'ul') continuation = '- ';
      else if (parsed.kind === 'ol') continuation = `${Number(parsed.num) + 1}. `;

      const next = [...lines];
      next.splice(idx + 1, 0, continuation);
      commitLines(next);
      focusLine(idx + 1);
      return;
    }

    if (e.key === 'Backspace') {
      if (parsed.prefix && parsed.text === '') {
        e.preventDefault();
        const next = [...lines];
        next[idx] = '';
        commitLines(next);
        focusLine(idx);
        return;
      }
      if (rawLine === '' && lines.length > 1) {
        e.preventDefault();
        const next = lines.filter((_, i) => i !== idx);
        commitLines(next);
        focusLine(Math.max(0, idx - 1));
        return;
      }
    }

    if (e.key === 'ArrowUp' && idx > 0) {
      e.preventDefault();
      setSlashQuery(null);
      focusLine(idx - 1);
    } else if (e.key === 'ArrowDown' && idx < lines.length - 1) {
      e.preventDefault();
      setSlashQuery(null);
      focusLine(idx + 1);
    } else if (e.key === 'Escape') {
      setSlashQuery(null);
      setFocusedIdx(null);
    }
  };

  const renderSlashMenu = (lineIndex: number) => {
    if (slashQuery === null) return null;
    return (
      <div
        onMouseDown={(e) => e.preventDefault()}
        className="mt-1 mb-1 w-full max-w-[260px] bg-white dark:bg-[#191A1E] border border-[#E7E5F0] dark:border-white/15 rounded-[12px] shadow-xl p-1.5 z-40 flex flex-col gap-0.5 max-h-[220px] overflow-y-auto sheldon-scroll"
      >
        <div className="px-2 py-1 text-[9.5px] font-bold uppercase tracking-wider text-[#6D6D6D] dark:text-white/45">
          Blocos Notion (/)
        </div>
        {filteredCommands.length === 0 ? (
          <div className="px-2.5 py-2 text-[11px] text-[#6D6D6D] dark:text-white/50">
            Nenhum comando encontrado
          </div>
        ) : (
          filteredCommands.map((cmd, cIdx) => {
            const IconComp = cmd.Icon;
            const active = cIdx === slashSelectedIdx;
            return (
              <button
                key={cmd.id}
                type="button"
                onClick={() => applySlashCommand(lineIndex, cmd)}
                className={`w-full px-2 py-1.5 rounded-[8px] flex items-center gap-2 text-left transition-colors ${
                  active
                    ? 'bg-[#FCE5D9]/75 dark:bg-[#FB7213]/20 text-[#242424] dark:text-white'
                    : 'hover:bg-[#F5F6FA] dark:hover:bg-white/[0.06] text-[#242424] dark:text-white/85'
                }`}
              >
                <div className="size-6 rounded-md bg-[#F5F6FA] dark:bg-white/10 flex items-center justify-center shrink-0 text-[#FB7213]">
                  <IconComp className="size-3.5" />
                </div>
                <span className="text-[11.5px] font-medium flex-1 truncate">{cmd.label}</span>
                <span className="text-[10px] font-mono text-[#6D6D6D] dark:text-white/40">
                  {cmd.hint}
                </span>
              </button>
            );
          })
        )}
      </div>
    );
  };

  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const lineIdx = i;
    const line = lines[i];

    // Fenced code block (``` ... ```)
    if (line.trim().startsWith('```')) {
      const startCodeIdx = i;
      const lang = line.trim().slice(3).trim();
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i += 1;
      }
      const endCodeIdx = i;
      const isEditingCode =
        editable && focusedIdx !== null && focusedIdx >= startCodeIdx && focusedIdx <= endCodeIdx;

      elements.push(
        <div
          key={`code-${startCodeIdx}`}
          onClick={() => editable && focusLine(startCodeIdx + 1)}
          className="my-2 rounded-[10px] bg-[#2D2E30] dark:bg-[#131418] text-white/95 p-2.5 font-mono text-[11px] overflow-x-auto sheldon-scroll border border-transparent dark:border-white/10 cursor-text"
        >
          {lang && (
            <div className="text-[9.5px] uppercase tracking-wider text-white/45 mb-1">
              {lang}
            </div>
          )}
          {isEditingCode ? (
            <textarea
              ref={(el) => {
                if (el) inputRefs.current.set(startCodeIdx + 1, el);
              }}
              value={codeLines.join('\n')}
              rows={Math.max(2, codeLines.length)}
              onChange={(e) => {
                const updatedInner = e.target.value.split('\n');
                const next = [
                  ...lines.slice(0, startCodeIdx + 1),
                  ...updatedInner,
                  ...lines.slice(endCodeIdx),
                ];
                commitLines(next);
              }}
              onBlur={() => setFocusedIdx(null)}
              className="w-full bg-transparent border-none outline-none text-white font-mono text-[11px] leading-relaxed resize-none"
            />
          ) : (
            <pre className="whitespace-pre-wrap leading-relaxed">
              {codeLines.join('\n') || '// código'}
            </pre>
          )}
        </div>
      );
      i += 1;
      continue;
    }

    // Standalone image line
    const standaloneImg = line.trim().match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (standaloneImg && focusedIdx !== lineIdx) {
      elements.push(
        <figure
          key={`img-${lineIdx}`}
          onClick={() => editable && focusLine(lineIdx)}
          className="my-2 cursor-pointer group relative"
        >
          <img
            src={standaloneImg[2]}
            alt={standaloneImg[1] || 'Imagem na nota'}
            className="rounded-[10px] w-full max-h-60 object-cover border border-[#E7E5F0] dark:border-white/10 shadow-xs"
          />
          {standaloneImg[1] && (
            <figcaption className="text-[10px] text-[#6D6D6D] dark:text-white/55 mt-1 text-center">
              {standaloneImg[1]}
            </figcaption>
          )}
        </figure>
      );
      i += 1;
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,})$/.test(line.trim()) && focusedIdx !== lineIdx) {
      elements.push(
        <hr
          key={`hr-${lineIdx}`}
          onClick={() => editable && focusLine(lineIdx)}
          className="my-2.5 border-[#E7E5F0] dark:border-white/10 cursor-pointer hover:border-[#FB7213]"
        />
      );
      i += 1;
      continue;
    }

    const parsed = parseEditableLine(line);
    const isFocused = editable && focusedIdx === lineIdx;

    if (isFocused) {
      const sizeClass =
        parsed.kind === 'h1'
          ? 'text-[17px] font-extrabold text-[#242424] dark:text-white mt-2 mb-1'
          : parsed.kind === 'h2'
            ? 'text-[15px] font-bold text-[#242424] dark:text-white mt-2 mb-1'
            : parsed.kind === 'h3'
              ? 'text-[13.5px] font-bold text-[#242424] dark:text-white mt-1.5 mb-0.5'
              : 'text-[12px] text-[#242424] dark:text-white/95 leading-relaxed';

      elements.push(
        <div key={`edit-${lineIdx}`} className="relative flex flex-col">
          <div
            className={`flex items-start gap-2 rounded-[6px] ${
              parsed.kind === 'quote'
                ? 'my-1 px-3 py-2 rounded-[9px] bg-[#FCE5D9]/45 dark:bg-[#FB7213]/15 border-l-[3px] border-[#FB7213]'
                : 'py-0.5'
            }`}
          >
            {parsed.kind === 'todo' && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onToggleCheckbox?.(lineIdx)}
                className={`size-3.5 mt-1 rounded-[4px] border-[1.5px] shrink-0 flex items-center justify-center transition-colors ${
                  parsed.checked
                    ? 'bg-[#0572AD] border-[#0572AD] text-white'
                    : 'bg-white dark:bg-transparent border-[#D5D9E2] dark:border-white/25'
                }`}
              >
                {parsed.checked && <span className="text-[9px] font-bold leading-none">✓</span>}
              </button>
            )}

            {parsed.kind === 'ul' && (
              <span className="text-[#FB7213] font-bold mt-[1px] pl-1">•</span>
            )}

            {parsed.kind === 'ol' && (
              <span className="text-[#6D6D6D] dark:text-white/60 font-semibold text-[11px] mt-[2px] pl-1 min-w-[14px]">
                {parsed.num}.
              </span>
            )}

            <input
              ref={(el) => {
                if (el) inputRefs.current.set(lineIdx, el);
              }}
              type="text"
              value={parsed.text}
              onChange={(e) => handleLineBodyChange(lineIdx, line, e.target.value)}
              onKeyDown={(e) => handleLineKeyDown(e, lineIdx, line)}
              onBlur={() => {
                setTimeout(() => {
                  setSlashQuery(null);
                  setFocusedIdx((curr) => (curr === lineIdx ? null : curr));
                }, 130);
              }}
              placeholder={
                lineIdx === lines.length - 1 || !parsed.prefix
                  ? "Digite '/' para comandos, '# ' título ou '[] ' tarefa..."
                  : 'Escreva aqui...'
              }
              className={`w-full bg-transparent border-none outline-none placeholder:text-[#6D6D6D]/45 dark:placeholder:text-white/30 ${sizeClass}`}
            />
          </div>

          {renderSlashMenu(lineIdx)}
        </div>
      );
      i += 1;
      continue;
    }

    // Visual Notion Rendering Modes (Click any element to edit seamlessly inline!)
    if (parsed.kind === 'h3') {
      elements.push(
        <h3
          key={`h3-${lineIdx}`}
          onClick={() => editable && focusLine(lineIdx)}
          className="text-[13.5px] font-bold text-[#242424] dark:text-white mt-2 mb-0.5 cursor-text rounded hover:bg-black/[0.02] dark:hover:bg-white/[0.03] px-0.5"
        >
          {parsed.text ? renderInlineMarkdown(parsed.text) : <span className="opacity-35">Título 3</span>}
        </h3>
      );
    } else if (parsed.kind === 'h2') {
      elements.push(
        <h2
          key={`h2-${lineIdx}`}
          onClick={() => editable && focusLine(lineIdx)}
          className="text-[15px] font-bold text-[#242424] dark:text-white mt-2.5 mb-1 cursor-text rounded hover:bg-black/[0.02] dark:hover:bg-white/[0.03] px-0.5"
        >
          {parsed.text ? renderInlineMarkdown(parsed.text) : <span className="opacity-35">Título 2</span>}
        </h2>
      );
    } else if (parsed.kind === 'h1') {
      elements.push(
        <h1
          key={`h1-${lineIdx}`}
          onClick={() => editable && focusLine(lineIdx)}
          className="text-[17px] font-extrabold text-[#242424] dark:text-white mt-2 mb-1 cursor-text rounded hover:bg-black/[0.02] dark:hover:bg-white/[0.03] px-0.5"
        >
          {parsed.text ? renderInlineMarkdown(parsed.text) : <span className="opacity-35">Título 1</span>}
        </h1>
      );
    } else if (parsed.kind === 'quote') {
      elements.push(
        <blockquote
          key={`quote-${lineIdx}`}
          onClick={() => editable && focusLine(lineIdx)}
          className="my-1.5 px-3 py-2 rounded-[9px] bg-[#FCE5D9]/45 dark:bg-[#FB7213]/15 border-l-[3px] border-[#FB7213] text-[12px] text-[#242424] dark:text-white/90 leading-relaxed cursor-text"
        >
          {parsed.text ? renderInlineMarkdown(parsed.text) : <span className="opacity-45">Destaque</span>}
        </blockquote>
      );
    } else if (parsed.kind === 'todo') {
      elements.push(
        <div
          key={`todo-${lineIdx}`}
          className="flex items-start gap-2 py-0.5 group rounded hover:bg-black/[0.02] dark:hover:bg-white/[0.03] px-0.5"
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleCheckbox?.(lineIdx);
            }}
            className={`size-3.5 mt-1 rounded-[4px] border-[1.5px] shrink-0 flex items-center justify-center transition-colors ${
              parsed.checked
                ? 'bg-[#0572AD] border-[#0572AD] text-white'
                : 'bg-white dark:bg-transparent border-[#D5D9E2] dark:border-white/25 hover:border-[#FB7213]'
            }`}
          >
            {parsed.checked && <span className="text-[9px] font-bold leading-none">✓</span>}
          </button>
          <span
            onClick={() => editable && focusLine(lineIdx)}
            className={`text-[12px] leading-relaxed flex-1 cursor-text ${
              parsed.checked
                ? 'line-through text-[#6D6D6D] dark:text-white/45'
                : 'text-[#242424] dark:text-white/90'
            }`}
          >
            {parsed.text ? renderInlineMarkdown(parsed.text) : <span className="opacity-35">Tarefa...</span>}
          </span>
        </div>
      );
    } else if (parsed.kind === 'ul') {
      elements.push(
        <div
          key={`ul-${lineIdx}`}
          onClick={() => editable && focusLine(lineIdx)}
          className="flex items-start gap-2 py-0.5 pl-1 text-[12px] text-[#242424] dark:text-white/90 cursor-text rounded hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
        >
          <span className="text-[#FB7213] font-bold mt-[1px]">•</span>
          <span className="leading-relaxed flex-1">
            {parsed.text ? renderInlineMarkdown(parsed.text) : <span className="opacity-35">Item</span>}
          </span>
        </div>
      );
    } else if (parsed.kind === 'ol') {
      elements.push(
        <div
          key={`ol-${lineIdx}`}
          onClick={() => editable && focusLine(lineIdx)}
          className="flex items-start gap-2 py-0.5 pl-1 text-[12px] text-[#242424] dark:text-white/90 cursor-text rounded hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
        >
          <span className="text-[#6D6D6D] dark:text-white/55 font-semibold text-[11px] mt-[1px] min-w-[14px]">
            {parsed.num}.
          </span>
          <span className="leading-relaxed flex-1">
            {parsed.text ? renderInlineMarkdown(parsed.text) : <span className="opacity-35">Item</span>}
          </span>
        </div>
      );
    } else if (!line.trim()) {
      elements.push(
        <div
          key={`empty-${lineIdx}`}
          onClick={() => editable && focusLine(lineIdx)}
          className="h-4 cursor-text rounded hover:bg-black/[0.02] dark:hover:bg-white/[0.03] flex items-center px-1 text-[10.5px] text-transparent hover:text-[#6D6D6D]/45 dark:hover:text-white/30 transition-colors"
        >
          {editable ? "Clique ou digite '/' para inserir um bloco..." : ''}
        </div>
      );
    } else {
      elements.push(
        <p
          key={`p-${lineIdx}`}
          onClick={() => editable && focusLine(lineIdx)}
          className="text-[12px] text-[#242424] dark:text-white/90 leading-relaxed my-0.5 cursor-text rounded hover:bg-black/[0.02] dark:hover:bg-white/[0.03] px-0.5"
        >
          {renderInlineMarkdown(line)}
        </p>
      );
    }

    i += 1;
  }

  return (
    <div className="flex flex-col select-text flex-1 min-h-[160px]">
      {elements}
      {editable && (
        <div
          onClick={() => {
            if (lines.length === 0 || lines[lines.length - 1].trim() !== '') {
              commitLines([...lines, '']);
              focusLine(lines.length);
            } else {
              focusLine(lines.length - 1);
            }
          }}
          className="flex-1 min-h-[48px] cursor-text flex items-start pt-2 px-0.5 text-[11px] text-[#6D6D6D]/45 dark:text-white/25"
        >
          {focusedIdx === null && "Digite '/' para comandos (# título, [] tarefa, > destaque)..."}
        </div>
      )}
    </div>
  );
};
