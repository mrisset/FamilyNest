import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import FontFamily from '@tiptap/extension-font-family';
import Heading from '@tiptap/extension-heading';
import Link from '@tiptap/extension-link';
import {
  Bold, Italic, UnderlineIcon, Strikethrough,
  AlignLeft, AlignCenter, AlignRight,
  List, ListOrdered, Heading1, Heading2, Heading3,
  Link as LinkIcon, Undo, Redo, Minus,
} from 'lucide-react';
import clsx from 'clsx';

interface Props {
  content: string;
  onChange: (html: string) => void;
  editable?: boolean;
}

function ToolbarBtn({
  onClick, active, disabled, title, children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={clsx(
        'p-1.5 rounded-lg transition-colors',
        active ? 'bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900' : 'text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-600',
        disabled && 'opacity-30 cursor-not-allowed',
      )}
    >
      {children}
    </button>
  );
}

const FONTS = [
  { label: 'Sans-serif', value: 'DM Sans, sans-serif' },
  { label: 'Serif', value: 'Georgia, serif' },
  { label: 'Mono', value: 'monospace' },
];

export default function RichEditor({ content, onChange, editable = true }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false }),
      Heading.configure({ levels: [1, 2, 3] }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TextStyle,
      Color,
      FontFamily,
      Link.configure({ openOnClick: false }),
    ],
    content,
    editable,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  if (!editor) return null;

  const addLink = () => {
    const url = window.prompt('URL du lien :');
    if (url) editor.chain().focus().setLink({ href: url }).run();
  };

  return (
    <div className={clsx(
      'border border-stone-200 dark:border-stone-700 rounded-xl overflow-hidden bg-white dark:bg-stone-800',
      editable && 'focus-within:ring-2 focus-within:ring-amber-400'
    )}>
      {editable && (
        <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-750">
          {/* Police */}
          <select
            className="text-xs text-stone-600 dark:text-stone-300 bg-transparent dark:bg-stone-700 border border-stone-200 dark:border-stone-600 rounded-lg px-1.5 py-1 mr-1 focus:outline-none focus:ring-1 focus:ring-amber-400"
            onChange={e => editor.chain().focus().setFontFamily(e.target.value).run()}
            defaultValue=""
          >
            <option value="" disabled>Police</option>
            {FONTS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>

          {/* Titres */}
          <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            active={editor.isActive('heading', { level: 1 })} title="Titre 1">
            <Heading1 size={14} />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            active={editor.isActive('heading', { level: 2 })} title="Titre 2">
            <Heading2 size={14} />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            active={editor.isActive('heading', { level: 3 })} title="Titre 3">
            <Heading3 size={14} />
          </ToolbarBtn>

          <span className="w-px h-4 bg-stone-200 dark:bg-stone-600 mx-1" />

          {/* Formatage */}
          <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()}
            active={editor.isActive('bold')} title="Gras">
            <Bold size={14} />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()}
            active={editor.isActive('italic')} title="Italique">
            <Italic size={14} />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleUnderline().run()}
            active={editor.isActive('underline')} title="Souligné">
            <UnderlineIcon size={14} />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleStrike().run()}
            active={editor.isActive('strike')} title="Barré">
            <Strikethrough size={14} />
          </ToolbarBtn>

          <span className="w-px h-4 bg-stone-200 dark:bg-stone-600 mx-1" />

          {/* Listes */}
          <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()}
            active={editor.isActive('bulletList')} title="Liste à puces">
            <List size={14} />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()}
            active={editor.isActive('orderedList')} title="Liste numérotée">
            <ListOrdered size={14} />
          </ToolbarBtn>

          <span className="w-px h-4 bg-stone-200 dark:bg-stone-600 mx-1" />

          {/* Alignement */}
          <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign('left').run()}
            active={editor.isActive({ textAlign: 'left' })} title="Aligner à gauche">
            <AlignLeft size={14} />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign('center').run()}
            active={editor.isActive({ textAlign: 'center' })} title="Centrer">
            <AlignCenter size={14} />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign('right').run()}
            active={editor.isActive({ textAlign: 'right' })} title="Aligner à droite">
            <AlignRight size={14} />
          </ToolbarBtn>

          <span className="w-px h-4 bg-stone-200 dark:bg-stone-600 mx-1" />

          {/* Couleur */}
          <label title="Couleur du texte" className="p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-600 cursor-pointer">
            <input type="color" className="sr-only w-0 h-0"
              onInput={(e) => editor.chain().focus().setColor((e.target as HTMLInputElement).value).run()} />
            <span className="text-xs font-bold" style={{ color: editor.getAttributes('textStyle').color || '#1c1917' }}>A</span>
          </label>

          {/* Lien */}
          <ToolbarBtn onClick={addLink} active={editor.isActive('link')} title="Ajouter un lien">
            <LinkIcon size={14} />
          </ToolbarBtn>

          {/* Séparateur horizontal */}
          <ToolbarBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Séparateur">
            <Minus size={14} />
          </ToolbarBtn>

          <span className="w-px h-4 bg-stone-200 dark:bg-stone-600 mx-1" />

          {/* Annuler/Refaire */}
          <ToolbarBtn onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()} title="Annuler">
            <Undo size={14} />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()} title="Refaire">
            <Redo size={14} />
          </ToolbarBtn>
        </div>
      )}

      <EditorContent
        editor={editor}
        className={clsx(
          'prose prose-stone dark:prose-invert max-w-none text-sm px-4 py-3 focus:outline-none',
          editable ? 'min-h-[200px]' : 'min-h-0',
          '[&_.ProseMirror]:outline-none',
          '[&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:mt-4 [&_h1]:mb-2',
          '[&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-1.5',
          '[&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1',
          '[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-0.5',
          '[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-0.5',
          '[&_a]:text-amber-700 dark:[&_a]:text-amber-400 [&_a]:underline',
          '[&_hr]:border-stone-200 dark:[&_hr]:border-stone-600 [&_hr]:my-3',
          '[&_p]:my-1 [&_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_p.is-editor-empty:first-child::before]:text-stone-400 [&_p.is-editor-empty:first-child::before]:float-left [&_p.is-editor-empty:first-child::before]:pointer-events-none',
        )}
      />
    </div>
  );
}
