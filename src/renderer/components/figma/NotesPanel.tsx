import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  ArrowDown01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Delete02Icon,
  File01Icon,
  Folder01Icon,
  FolderAddIcon,
  FolderOpenIcon,
  ImageAdd01Icon,
  Maximize01Icon,
  Minimize01Icon,
  NoteAddIcon,
} from '@hugeicons/core-free-icons';
import type { NoteDocument, NoteFolder } from '@shared/types';
import panelLeftSvg from '../../assets/figma/v2/panel-left.svg';
import { NotionMarkdownView } from './NotionMarkdownView';

const FOLDERS_KEY = 'sheldon_notes_folders_v2';
const NOTES_KEY = 'sheldon_notes_docs_v2';

const COVER_PRESETS: { id: string; label: string; css: string }[] = [
  {
    id: 'sunset',
    label: 'Laranja Sheldon',
    css: 'linear-gradient(120deg, #FB7213 0%, #FEB14A 52%, #FCE5D9 100%)',
  },
  {
    id: 'ocean',
    label: 'Azul Manhã',
    css: 'linear-gradient(120deg, #0572AD 0%, #6CC6F0 55%, #DFF3FE 100%)',
  },
  {
    id: 'sand',
    label: 'Creme Quente',
    css: 'linear-gradient(120deg, #55321E 0%, #C07A4B 50%, #F4EDE5 100%)',
  },
  {
    id: 'aurora',
    label: 'Foco Noturno',
    css: 'linear-gradient(120deg, #2D2E30 0%, #4E5154 60%, #FB7213 100%)',
  },
];

const NOTE_EMOJIS = ['📝', '🚀', '🐱', '💡', '📚', '🎯', '✨', '🧠', '🔥', '📌'];

const INITIAL_FOLDERS: NoteFolder[] = [
  { id: 'fld-projetos', name: 'Projetos', parentId: null, expanded: true },
  { id: 'fld-sheldon', name: 'Sheldon Focus', parentId: 'fld-projetos', expanded: true },
  { id: 'fld-pessoal', name: 'Pessoal', parentId: null, expanded: false },
];

const INITIAL_NOTES: NoteDocument[] = [
  {
    id: 'note-1',
    title: 'Ideias e Melhorias do App',
    folderId: 'fld-sheldon',
    icon: '🐱',
    coverImage: COVER_PRESETS[0].css,
    updatedAt: Date.now(),
    content: `# Planejamento Sheldon Focus

> Dica do Sheldon: use **blocos de Markdown** abaixo e clique nos checkboxes para marcar o que já finalizou!

## Próximos passos
- [x] Novo design limpo no estilo Notion
- [x] Pastas expansíveis direto na árvore lateral
- [ ] Revisar metas da semana no modo foco

## Notas rápidas
\`\`\`ts
const foco = "Sem procrastinação hoje!";
\`\`\`

---
Você pode adicionar **imagens**, *itálico*, listas e títulos igual ao Notion.`,
  },
  {
    id: 'note-2',
    title: 'Checklist de Sprint',
    folderId: 'fld-projetos',
    icon: '🚀',
    coverImage: COVER_PRESETS[1].css,
    updatedAt: Date.now() - 3600_000,
    content: `# Checklist de Sprint

- [ ] Definir prioridades de alta urgência
- [ ] Organizar blocos de Deep Work das 08:00 às 12:00
- [ ] Conferir lembretes do dia`,
  },
  {
    id: 'note-3',
    title: 'Diário de Foco',
    folderId: 'fld-pessoal',
    icon: '✨',
    coverImage: COVER_PRESETS[2].css,
    updatedAt: Date.now() - 7200_000,
    content: `# Diário de Foco

Hoje mantive constância nas tarefas principais sem distrações!

- Energia pela manhã: **Alta**
- Sessões de Pomodoro concluídas: 4`,
  },
  {
    id: 'note-4',
    title: 'Anotações Rápidas',
    folderId: null,
    icon: '📝',
    updatedAt: Date.now() - 9000_000,
    content: `# Anotações Rápidas

Escreva qualquer rascunho aqui em **Markdown**!`,
  },
];

interface NotesPanelProps {
  onToggleCollapse?: () => void;
}

export const NotesPanel: React.FC<NotesPanelProps> = ({ onToggleCollapse }) => {
  const [folders, setFolders] = useState<NoteFolder[]>(() => {
    try {
      const saved = localStorage.getItem(FOLDERS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as NoteFolder[];
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return INITIAL_FOLDERS;
  });

  const [notes, setNotes] = useState<NoteDocument[]>(() => {
    try {
      const saved = localStorage.getItem(NOTES_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as NoteDocument[];
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return INITIAL_NOTES;
  });

  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [isFullscreenNote, setIsFullscreenNote] = useState<boolean>(false);
  const [showCoverPicker, setShowCoverPicker] = useState<boolean>(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState<boolean>(false);
  const [coverUrlDraft, setCoverUrlDraft] = useState<string>('');
  const [showImagePrompt, setShowImagePrompt] = useState<boolean>(false);
  const [inlineImageUrl, setInlineImageUrl] = useState<string>('');
  const [pendingImageLineIdx, setPendingImageLineIdx] = useState<number | null>(null);

  // Inline creation states inside folder tree
  const [creatingType, setCreatingType] = useState<'folder' | 'note' | null>(null);
  const [creatingParentId, setCreatingParentId] = useState<string | null>(null);
  const [createNameDraft, setCreateNameDraft] = useState<string>('');

  const coverFileInputRef = useRef<HTMLInputElement | null>(null);
  const inlineFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
    } catch {
      // ignore
    }
  }, [folders]);

  useEffect(() => {
    try {
      localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
    } catch {
      // ignore
    }
  }, [notes]);

  const activeNote = notes.find((n) => n.id === activeNoteId) || null;

  const toggleFolderExpand = (folderId: string) => {
    setFolders((prev) =>
      prev.map((f) => (f.id === folderId ? { ...f, expanded: !f.expanded } : f))
    );
  };

  const handleStartCreate = (type: 'folder' | 'note', parentId: string | null) => {
    if (parentId) {
      setFolders((prev) =>
        prev.map((f) => (f.id === parentId ? { ...f, expanded: true } : f))
      );
    }
    setCreatingType(type);
    setCreatingParentId(parentId);
    setCreateNameDraft('');
  };

  const handleConfirmCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = createNameDraft.trim();
    if (!clean) {
      setCreatingType(null);
      return;
    }

    if (creatingType === 'folder') {
      const newFolder: NoteFolder = {
        id: `fld-${Date.now()}`,
        name: clean,
        parentId: creatingParentId,
        expanded: true,
      };
      setFolders((prev) => [...prev, newFolder]);
    } else if (creatingType === 'note') {
      const newNote: NoteDocument = {
        id: `note-${Date.now()}`,
        title: clean,
        folderId: creatingParentId,
        icon: '📝',
        coverImage: COVER_PRESETS[0].css,
        content: `# ${clean}\n\nComece a escrever suas ideias em **Markdown**...`,
        updatedAt: Date.now(),
      };
      setNotes((prev) => [newNote, ...prev]);
      setActiveNoteId(newNote.id);
    }

    setCreatingType(null);
    setCreateNameDraft('');
  };

  const handleDeleteFolder = (folderId: string) => {
    // Collect descendant folders recursively
    const toRemove = new Set<string>([folderId]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const f of folders) {
        if (f.parentId && toRemove.has(f.parentId) && !toRemove.has(f.id)) {
          toRemove.add(f.id);
          changed = true;
        }
      }
    }
    setFolders((prev) => prev.filter((f) => !toRemove.has(f.id)));
    setNotes((prev) => prev.filter((n) => !n.folderId || !toRemove.has(n.folderId)));
  };

  const handleDeleteNote = (noteId: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
    if (activeNoteId === noteId) {
      setActiveNoteId(null);
      setIsFullscreenNote(false);
    }
  };

  const updateActiveNote = (patch: Partial<NoteDocument>) => {
    if (!activeNote) return;
    setNotes((prev) =>
      prev.map((n) => (n.id === activeNote.id ? { ...n, ...patch, updatedAt: Date.now() } : n))
    );
  };

  const insertImageAtLine = (altText: string, srcUrl: string) => {
    if (!activeNote) return;
    const lines = activeNote.content ? activeNote.content.split('\n') : [''];
    const md = `![${altText}](${srcUrl})`;
    if (pendingImageLineIdx !== null && pendingImageLineIdx >= 0 && pendingImageLineIdx < lines.length) {
      lines[pendingImageLineIdx] = md;
      updateActiveNote({ content: lines.join('\n') });
    } else {
      updateActiveNote({ content: `${activeNote.content}\n${md}` });
    }
    setPendingImageLineIdx(null);
  };

  const handleToggleMarkdownCheckbox = (lineIdx: number) => {
    if (!activeNote) return;
    const lines = activeNote.content.split('\n');
    const target = lines[lineIdx];
    if (!target) return;
    if (/^\s*-\s+\[\s\]\s+/.test(target)) {
      lines[lineIdx] = target.replace(/^(\s*-\s+\[)\s(\]\s+)/, '$1x$2');
    } else if (/^\s*-\s+\[[xX]\]\s+/.test(target)) {
      lines[lineIdx] = target.replace(/^(\s*-\s+\[)[xX](\]\s+)/, '$1 $2');
    }
    updateActiveNote({ content: lines.join('\n') });
  };

  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    mode: 'cover' | 'inline'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!result) return;
      if (mode === 'cover') {
        updateActiveNote({ coverImage: result });
        setShowCoverPicker(false);
      } else {
        insertImageAtLine(file.name.replace(/\.[^/.]+$/, ''), result);
        setShowImagePrompt(false);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const getFolderBreadcrumb = (folderId: string | null): string => {
    if (!folderId) return 'Notas';
    const parts: string[] = [];
    let curr = folders.find((f) => f.id === folderId);
    while (curr) {
      parts.unshift(curr.name);
      curr = curr.parentId ? folders.find((f) => f.id === curr?.parentId) : undefined;
    }
    return parts.join(' / ') || 'Notas';
  };

  const renderTree = (parentId: string | null, depth = 0): React.ReactNode => {
    const childFolders = folders.filter((f) => f.parentId === parentId);
    const childNotes = notes.filter((n) => n.folderId === parentId);

    return (
      <div
        className={`flex flex-col gap-0.5 ${
          depth > 0 ? 'ml-3 pl-2.5 border-l border-[#E7E5F0]' : ''
        }`}
      >
        {/* Inline create box right inside target folder */}
        {creatingType && creatingParentId === parentId && (
          <form onSubmit={handleConfirmCreate} className="flex items-center gap-1.5 py-1 px-1.5 bg-[#F5F6FA] rounded-[10px]">
            <input
              type="text"
              autoFocus
              value={createNameDraft}
              onChange={(e) => setCreateNameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setCreatingType(null);
              }}
              placeholder={creatingType === 'folder' ? 'Nome da pasta...' : 'Título da nota...'}
              className="flex-1 bg-white rounded-[8px] px-2.5 py-1 text-[12px] font-medium text-[#242424] border border-[#E7E5F0] outline-none focus:border-[#FB7213] min-w-0"
            />
            <button
              type="submit"
              className="px-2.5 py-1 rounded-[8px] bg-[#FB7213] text-white text-[11px] font-semibold shrink-0"
            >
              OK
            </button>
          </form>
        )}

        {childFolders.map((folder) => {
          const isOpen = Boolean(folder.expanded);
          return (
            <div key={folder.id} className="flex flex-col">
              <div
                onClick={() => toggleFolderExpand(folder.id)}
                className="flex items-center gap-1.5 px-2 py-1 rounded-[9px] hover:bg-[#F5F6FA] dark:hover:bg-[#2A2C32] cursor-pointer group transition-colors"
              >
                <span className="text-[#6D6D6D] dark:text-white/55 shrink-0">
                  <HugeiconsIcon
                    icon={isOpen ? ArrowDown01Icon : ArrowRight01Icon}
                    size={12}
                    strokeWidth={2}
                  />
                </span>
                <span className="text-[#FB7213] shrink-0">
                  <HugeiconsIcon
                    icon={isOpen ? FolderOpenIcon : Folder01Icon}
                    size={15}
                    strokeWidth={1.9}
                  />
                </span>
                <span className="text-[11.5px] font-semibold text-[#242424] dark:text-white truncate flex-1">
                  {folder.name}
                </span>

                <div
                  className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 shrink-0 transition-opacity"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => handleStartCreate('note', folder.id)}
                    title="Nova nota dentro desta pasta"
                    className="size-5 rounded-md hover:bg-white dark:hover:bg-black/30 text-[#6D6D6D] dark:text-white/70 hover:text-[#FB7213] flex items-center justify-center"
                  >
                    <HugeiconsIcon icon={NoteAddIcon} size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStartCreate('folder', folder.id)}
                    title="Nova subpasta"
                    className="size-5 rounded-md hover:bg-white dark:hover:bg-black/30 text-[#6D6D6D] dark:text-white/70 hover:text-[#FB7213] flex items-center justify-center"
                  >
                    <HugeiconsIcon icon={FolderAddIcon} size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteFolder(folder.id)}
                    title="Excluir pasta"
                    className="size-5 rounded-md hover:bg-white dark:hover:bg-black/30 text-[#6D6D6D] dark:text-white/70 hover:text-[#E05555] flex items-center justify-center"
                  >
                    <HugeiconsIcon icon={Delete02Icon} size={12} />
                  </button>
                </div>
              </div>

              {/* Inline expanded children directly underneath */}
              {isOpen && <div className="mt-0.5">{renderTree(folder.id, depth + 1)}</div>}
            </div>
          );
        })}

        {childNotes.map((note) => (
          <div
            key={note.id}
            onClick={() => setActiveNoteId(note.id)}
            className="flex items-center gap-2 px-2 py-1 rounded-[9px] hover:bg-[#FCE5D9]/45 dark:hover:bg-[#FB7213]/15 cursor-pointer group transition-colors"
          >
            <span className="text-[13px] leading-none shrink-0">{note.icon || '📄'}</span>
            <span className="text-[#6D6D6D] shrink-0 hidden">
              <HugeiconsIcon icon={File01Icon} size={13} />
            </span>
            <span className="text-[11.5px] font-medium text-[#242424] dark:text-white/90 truncate flex-1">
              {note.title || 'Sem título'}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteNote(note.id);
              }}
              title="Excluir nota"
              className="opacity-0 group-hover:opacity-100 size-5 rounded-md hover:bg-white dark:hover:bg-black/30 text-[#6D6D6D] dark:text-white/60 hover:text-[#E05555] flex items-center justify-center shrink-0 transition-opacity"
            >
              <HugeiconsIcon icon={Delete02Icon} size={12} />
            </button>
          </div>
        ))}
      </div>
    );
  };

  const renderNotionDocument = (wideModal: boolean) => {
    if (!activeNote) return null;

    const isGradientCover = activeNote.coverImage?.startsWith('linear-gradient');

    return (
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-white dark:bg-[#1F2024]">
        {/* Hidden File Inputs for local cover / inline image */}
        <input
          ref={coverFileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFileUpload(e, 'cover')}
        />
        <input
          ref={inlineFileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFileUpload(e, 'inline')}
        />

        {/* Clean Notion Top Bar (no mode switcher clutter) */}
        <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#E7E5F0] dark:border-white/[0.08] shrink-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <button
              type="button"
              onClick={() => {
                if (wideModal) {
                  setIsFullscreenNote(false);
                } else {
                  setActiveNoteId(null);
                }
              }}
              className="h-[26px] px-2 rounded-[7px] bg-[#F5F6FA] dark:bg-[#2A2C32] hover:bg-[#ECEEF5] dark:hover:bg-[#343740] text-[11px] font-semibold text-[#242424] dark:text-white flex items-center gap-1 shrink-0 transition-colors"
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} size={13} strokeWidth={2} />
              <span>{wideModal ? 'Voltar ao painel' : 'Pastas'}</span>
            </button>

            <span className="text-[10.5px] text-[#6D6D6D] dark:text-white/50 truncate">
              {getFolderBreadcrumb(activeNote.folderId)}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsFullscreenNote((prev) => !prev)}
            title={wideModal ? 'Minimizar para barra lateral' : 'Expandir nota no estilo Notion'}
            className="size-[26px] rounded-[7px] bg-[#F5F6FA] dark:bg-[#2A2C32] hover:bg-[#FECCAA]/40 dark:hover:bg-white/10 text-[#242424] dark:text-white flex items-center justify-center transition-colors shrink-0"
          >
            <HugeiconsIcon
              icon={wideModal ? Minimize01Icon : Maximize01Icon}
              size={13}
              strokeWidth={2}
            />
          </button>
        </div>

        {/* Scrollable Notion Page Body */}
        <div className="flex-1 min-h-0 overflow-y-auto sheldon-scroll pr-1 pt-2.5 flex flex-col gap-3">
          {/* Notion Cover Banner */}
          <div className="relative group shrink-0">
            {activeNote.coverImage ? (
              <div
                className={`w-full ${
                  wideModal ? 'h-[160px]' : 'h-[96px]'
                } rounded-[14px] overflow-hidden relative border border-[#E7E5F0]`}
                style={
                  isGradientCover
                    ? { background: activeNote.coverImage }
                    : undefined
                }
              >
                {!isGradientCover && (
                  <img
                    src={activeNote.coverImage}
                    alt="Capa da nota"
                    className="w-full h-full object-cover"
                  />
                )}
                <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={() => setShowCoverPicker((p) => !p)}
                    className="px-2 py-1 rounded-md bg-white/90 hover:bg-white text-[10px] font-semibold text-[#242424] shadow-xs"
                  >
                    Alterar capa
                  </button>
                  <button
                    type="button"
                    onClick={() => updateActiveNote({ coverImage: undefined })}
                    className="px-2 py-1 rounded-md bg-white/90 hover:bg-white text-[10px] font-semibold text-[#E05555] shadow-xs"
                  >
                    Remover
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowCoverPicker((p) => !p)}
                className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#6D6D6D] hover:text-[#FB7213] px-2 py-1 rounded-md hover:bg-[#F5F6FA] transition-colors"
              >
                <HugeiconsIcon icon={ImageAdd01Icon} size={14} />
                <span>Adicionar capa</span>
              </button>
            )}

            {/* Cover Picker Popover */}
            {showCoverPicker && (
              <div className="mt-2 p-3 rounded-[14px] bg-[#F5F6FA] border border-[#E7E5F0] flex flex-col gap-2.5 z-20">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-[#242424]">Escolha uma capa</span>
                  <button
                    type="button"
                    onClick={() => coverFileInputRef.current?.click()}
                    className="text-[11px] font-semibold text-[#FB7213] hover:underline"
                  >
                    Enviar imagem do PC
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {COVER_PRESETS.map((preset) => (
                    <button
                      type="button"
                      key={preset.id}
                      onClick={() => {
                        updateActiveNote({ coverImage: preset.css });
                        setShowCoverPicker(false);
                      }}
                      title={preset.label}
                      className="h-8 rounded-[8px] border border-white/60 shadow-xs hover:scale-105 transition-transform"
                      style={{ background: preset.css }}
                    />
                  ))}
                </div>
                <div className="flex gap-1.5">
                  <input
                    type="url"
                    value={coverUrlDraft}
                    onChange={(e) => setCoverUrlDraft(e.target.value)}
                    placeholder="Ou cole a URL de uma imagem..."
                    className="flex-1 bg-white rounded-[8px] px-2.5 py-1 text-[11px] border border-[#E7E5F0] outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (coverUrlDraft.trim()) {
                        updateActiveNote({ coverImage: coverUrlDraft.trim() });
                        setCoverUrlDraft('');
                        setShowCoverPicker(false);
                      }
                    }}
                    className="px-2.5 py-1 rounded-[8px] bg-[#FB7213] text-white text-[11px] font-semibold"
                  >
                    Aplicar
                  </button>
                </div>
              </div>
            )}

            {/* Overlapping Notion Emoji Icon */}
            <div className={`relative ${activeNote.coverImage ? '-mt-5 ml-3' : 'mt-1'} inline-block`}>
              <button
                type="button"
                onClick={() => setShowEmojiPicker((p) => !p)}
                title="Alterar ícone da página"
                className="size-10 rounded-[12px] bg-white border border-[#E7E5F0] shadow-xs flex items-center justify-center text-[22px] hover:scale-105 transition-transform"
              >
                {activeNote.icon || '📝'}
              </button>

              {showEmojiPicker && (
                <div className="absolute left-0 top-12 bg-white border border-[#E7E5F0] rounded-[12px] shadow-lg p-2 flex flex-wrap gap-1 w-44 z-30">
                  {NOTE_EMOJIS.map((em) => (
                    <button
                      type="button"
                      key={em}
                      onClick={() => {
                        updateActiveNote({ icon: em });
                        setShowEmojiPicker(false);
                      }}
                      className="size-8 rounded-lg hover:bg-[#F5F6FA] flex items-center justify-center text-[18px]"
                    >
                      {em}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Notion Editable H1 Title */}
          <input
            type="text"
            value={activeNote.title}
            onChange={(e) => updateActiveNote({ title: e.target.value })}
            placeholder="Sem título"
            className={`${
              wideModal ? 'text-[22px]' : 'text-[17px]'
            } font-extrabold text-[#242424] dark:text-white bg-transparent border-none outline-none px-0.5 leading-tight select-text`}
          />

          {showImagePrompt && (
            <div className="p-2 rounded-[10px] bg-[#F5F6FA] dark:bg-[#26282E] border border-[#E7E5F0] dark:border-white/10 flex items-center gap-1.5 shrink-0">
              <input
                type="url"
                value={inlineImageUrl}
                onChange={(e) => setInlineImageUrl(e.target.value)}
                placeholder="Cole a URL da imagem..."
                className="flex-1 bg-white dark:bg-[#191A1E] text-[#242424] dark:text-white rounded-[7px] px-2.5 py-1 text-[11px] border border-[#E7E5F0] dark:border-white/10 outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  if (inlineImageUrl.trim()) {
                    insertImageAtLine('Imagem', inlineImageUrl.trim());
                    setInlineImageUrl('');
                    setShowImagePrompt(false);
                  }
                }}
                className="px-2.5 py-1 rounded-[7px] bg-[#FB7213] text-white text-[10.5px] font-semibold"
              >
                Inserir
              </button>
              <button
                type="button"
                onClick={() => inlineFileInputRef.current?.click()}
                className="px-2.5 py-1 rounded-[7px] bg-white dark:bg-[#191A1E] border border-[#E7E5F0] dark:border-white/10 text-[#242424] dark:text-white text-[10.5px] font-semibold"
              >
                Arquivo
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowImagePrompt(false);
                  setPendingImageLineIdx(null);
                }}
                className="px-1.5 py-1 text-[11px] text-[#6D6D6D] hover:text-[#E05555]"
              >
                ×
              </button>
            </div>
          )}

          {/* Single Always-Visual Notion Live Canvas (slash `/` menu + inline markdown) */}
          <div className="flex-1 min-h-[180px] flex flex-col">
            <NotionMarkdownView
              content={activeNote.content}
              onChangeContent={(content) => updateActiveNote({ content })}
              onToggleCheckbox={handleToggleMarkdownCheckbox}
              onRequestInsertImage={(idx) => {
                setPendingImageLineIdx(idx);
                setShowImagePrompt(true);
              }}
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div
        className="bg-white dark:bg-[#1F2024] border border-transparent dark:border-white/[0.06] rounded-[16px] shadow-[0_2px_12px_rgba(16,24,40,0.03)] flex flex-col px-3 py-3 select-none flex-1 min-h-0 overflow-hidden"
        aria-label="Notas"
      >
        {activeNote ? (
          renderNotionDocument(false)
        ) : (
          <>
            {/* Header: Notas + New Folder / New Note + Collapse */}
            <div className="flex items-center justify-between w-full mb-2.5 shrink-0 gap-1.5">
              <div className="flex flex-col gap-0.5">
                <h3 className="text-[12px] font-semibold text-[#242424] dark:text-white">Notas</h3>
                <span className="text-[10px] text-[#6D6D6D] dark:text-[#9CA3AF]">
                  {folders.length} pastas · {notes.length} arquivos
                </span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleStartCreate('folder', null)}
                  title="Nova pasta"
                  className="h-[28px] px-2 rounded-[7px] bg-[#F5F6FA] dark:bg-[#2A2C32] hover:bg-[#ECEEF5] dark:hover:bg-[#343740] text-[#242424] dark:text-white text-[10.5px] font-semibold flex items-center gap-1 transition-colors"
                >
                  <HugeiconsIcon icon={FolderAddIcon} size={13} />
                  <span>Pasta</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleStartCreate('note', null)}
                  title="Nova nota"
                  className="h-[28px] px-2 rounded-[7px] bg-[#FB7213] hover:bg-[#E06209] text-white text-[10.5px] font-semibold flex items-center gap-1 transition-colors"
                >
                  <HugeiconsIcon icon={NoteAddIcon} size={13} />
                  <span>Nota</span>
                </button>
                {onToggleCollapse && (
                  <button
                    type="button"
                    onClick={onToggleCollapse}
                    className="bg-[#E5E7EB]/85 dark:bg-[#2A2C32] hover:bg-[#D5D8E0] dark:hover:bg-[#343740] size-[28px] rounded-[7px] flex items-center justify-center transition-all active:scale-95"
                    title="Ocultar painel direito"
                  >
                    <img src={panelLeftSvg} width={16} height={16} alt="Recolher" className="block dark:invert" />
                  </button>
                )}
              </div>
            </div>

            {/* Inline Obsidian/Notion Folder Tree */}
            <div className="flex-1 min-h-0 overflow-y-auto sheldon-scroll pr-0.5">
              {renderTree(null, 0)}
            </div>
          </>
        )}
      </div>

      {/* Full Notion-style Centered Document Modal when expanded */}
      {isFullscreenNote &&
        activeNote &&
        createPortal(
          <div
            onClick={() => setIsFullscreenNote(false)}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[3px] flex items-center justify-center p-6 sm:p-10"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[820px] h-[82vh] bg-white dark:bg-[#1F2024] rounded-[20px] shadow-2xl border border-[#E7E5F0] dark:border-white/10 p-5 flex flex-col overflow-hidden"
            >
              {renderNotionDocument(true)}
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
