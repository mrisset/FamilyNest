import { useMemo, useEffect, useRef, useState } from 'react';
import { Info } from 'lucide-react';
import clsx from 'clsx';

interface TocItem {
  id: string;
  text: string;
  level: 1 | 2 | 3;
}

// Parse le HTML, ajoute des id sur les titres, retourne le HTML modifié + la liste des titres
function buildToc(html: string): { processedHtml: string; toc: TocItem[] } {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const toc: TocItem[] = [];
  const counts = new Map<string, number>();

  doc.querySelectorAll('h1, h2, h3').forEach(el => {
    const text = el.textContent?.trim() ?? '';
    if (!text) return;
    const base = text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '') || 'section';
    const n = counts.get(base) ?? 0;
    counts.set(base, n + 1);
    const id = n > 0 ? `${base}-${n}` : base;
    el.id = id;
    toc.push({ id, text, level: parseInt(el.tagName[1]) as 1 | 2 | 3 });
  });

  return { processedHtml: doc.body.innerHTML, toc };
}

interface Props {
  richDescription: string | null;
  canEdit: boolean;
}

export default function InfoPanel({ richDescription, canEdit }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const { processedHtml, toc } = useMemo(() => {
    if (!richDescription) return { processedHtml: '', toc: [] };
    return buildToc(richDescription);
  }, [richDescription]);

  // Surligne la section visible dans le sommaire via IntersectionObserver
  useEffect(() => {
    const container = contentRef.current;
    if (!container || toc.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // On prend le premier titre visible depuis le haut
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) setActiveId(visible[0].target.id);
      },
      { root: container, rootMargin: '0px 0px -80% 0px', threshold: 0 },
    );

    toc.forEach(({ id }) => {
      const el = container.querySelector(`#${id}`);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [toc, processedHtml]);

  const scrollTo = (id: string) => {
    contentRef.current?.querySelector(`#${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (!richDescription) {
    return (
      <div className="flex-1 flex items-center justify-center flex-col gap-2 text-stone-400 dark:text-stone-500 text-sm py-16">
        <Info size={32} className="opacity-30" />
        <p>Aucune description détaillée</p>
        {canEdit && (
          <p className="text-xs text-stone-300 dark:text-stone-600">Ajoutez-en une via le bouton ⚙ en haut</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sommaire */}
      {toc.length >= 2 && (
        <aside className="w-52 flex-shrink-0 overflow-y-auto border-r border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/50 py-5 px-3">
          <p className="text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider mb-3 px-2">
            Sommaire
          </p>
          <nav className="space-y-0.5">
            {toc.map(({ id, text, level }) => (
              <button
                key={id}
                onClick={() => scrollTo(id)}
                className={clsx(
                  'w-full text-left text-sm rounded-lg px-2 py-1.5 transition-colors leading-snug truncate',
                  level === 2 && 'pl-4',
                  level === 3 && 'pl-6 text-xs',
                  activeId === id
                    ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 font-medium'
                    : 'text-stone-500 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700 hover:text-stone-800 dark:hover:text-stone-200',
                )}
              >
                {text}
              </button>
            ))}
          </nav>
        </aside>
      )}

      {/* Contenu */}
      <div ref={contentRef} className="flex-1 overflow-y-auto p-6">
        <div
          className={clsx(
            'prose prose-stone dark:prose-invert max-w-none text-sm break-words [overflow-wrap:anywhere]',
            '[&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:mt-4 [&_h1]:mb-2',
            '[&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-1.5',
            '[&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1',
            '[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-0.5',
            '[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-0.5',
            '[&_a]:text-amber-700 dark:[&_a]:text-amber-400 [&_a]:underline',
            '[&_hr]:border-stone-200 dark:[&_hr]:border-stone-600 [&_hr]:my-3',
            '[&_p]:my-1',
          )}
          dangerouslySetInnerHTML={{ __html: processedHtml }}
        />
      </div>
    </div>
  );
}
