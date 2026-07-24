import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const HEIGHT_CAP = 680;

interface Props {
  html?: string | null;
  text?: string | null;
}

/**
 * Inject a <base target="_blank"> and defensive responsive styles into the
 * email's HTML so it renders isolated inside an iframe. Rendering in an iframe
 * (rather than inline) means the email's own @media rules respond to the reader
 * width, images/tables are capped to the frame, and its CSS can't leak into the
 * app — fixing the "narrow column / infinitely tall / not responsive" problem.
 */
function buildSrcDoc(html: string): string {
  const head =
    `<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<base target="_blank">` +
    `<style>` +
    `html,body{margin:0;padding:0;background:#ffffff;}` +
    `body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1f2937;word-wrap:break-word;overflow-wrap:anywhere;-webkit-text-size-adjust:100%;}` +
    `img{max-width:100%!important;height:auto;}` +
    `table{max-width:100%;}` +
    `a{color:#2563eb;}` +
    `*{box-sizing:border-box;}` +
    `</style>`;

  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `${head}</head>`);
  }
  if (/<html[\s>]/i.test(html)) {
    return html.replace(/<html([^>]*)>/i, `<html$1><head>${head}</head>`);
  }
  return `<!doctype html><html><head>${head}</head><body>${html}</body></html>`;
}

function EmailFrame({ html, onHeight }: { html: string; onHeight: (h: number) => void }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const srcDoc = useMemo(() => buildSrcDoc(html), [html]);

  useEffect(() => {
    const iframe = ref.current;
    if (!iframe) return;
    let ro: ResizeObserver | null = null;

    const measure = () => {
      const doc = iframe.contentDocument;
      if (!doc?.body) return;
      const h = Math.max(doc.documentElement.scrollHeight, doc.body.scrollHeight) + 4;
      iframe.style.height = `${h}px`;
      onHeight(h);
    };

    const onLoad = () => {
      measure();
      const doc = iframe.contentDocument;
      // Re-measure once images finish loading (they change the height).
      doc?.querySelectorAll('img').forEach((img) => {
        const el = img as HTMLImageElement;
        if (!el.complete) el.addEventListener('load', measure, { once: true });
      });
      setTimeout(measure, 250);
      setTimeout(measure, 800);
      // Re-measure only when the reader panel (iframe width) changes — guarding
      // against a feedback loop from our own height updates.
      if ('ResizeObserver' in window) {
        let lastWidth = iframe.clientWidth;
        ro = new ResizeObserver((entries) => {
          const w = entries[0].contentRect.width;
          if (Math.abs(w - lastWidth) < 1) return;
          lastWidth = w;
          measure();
        });
        ro.observe(iframe);
      }
    };

    iframe.addEventListener('load', onLoad);
    return () => {
      iframe.removeEventListener('load', onLoad);
      ro?.disconnect();
    };
  }, [srcDoc, onHeight]);

  return (
    <iframe
      ref={ref}
      srcDoc={srcDoc}
      title="Email content"
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      className="block w-full border-0 bg-white"
      style={{ height: 200 }}
    />
  );
}

function ShowMoreButton({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="mt-2 inline-flex items-center gap-1 rounded-md border bg-muted/60 px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-180')} />
      {expanded ? 'Show less' : 'Show full message'}
    </button>
  );
}

const Fade = () => (
  <div
    className="pointer-events-none absolute inset-x-0 bottom-0 h-16"
    style={{ background: 'linear-gradient(to top, #ffffff, rgba(255,255,255,0))' }}
  />
);

export function EmailBody({ html, text }: Props) {
  const [height, setHeight] = useState(0);
  const [expanded, setExpanded] = useState(false);

  if (html) {
    const tall = height > HEIGHT_CAP + 60;
    return (
      <div className="w-full min-w-0">
        <div
          className="relative w-full overflow-hidden rounded-md"
          style={{ maxHeight: tall && !expanded ? HEIGHT_CAP : undefined }}
        >
          <EmailFrame html={html} onHeight={setHeight} />
          {tall && !expanded && <Fade />}
        </div>
        {tall && <ShowMoreButton expanded={expanded} onToggle={() => setExpanded((v) => !v)} />}
      </div>
    );
  }

  // Plain-text email
  const longText = (text?.length ?? 0) > 1600;
  return (
    <div className="w-full min-w-0">
      <div className="relative overflow-hidden" style={{ maxHeight: longText && !expanded ? HEIGHT_CAP : undefined }}>
        <pre className="whitespace-pre-wrap break-words font-sans text-sm text-foreground/90">{text}</pre>
        {longText && !expanded && (
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-16"
            style={{ background: 'linear-gradient(to top, hsl(var(--card)), transparent)' }}
          />
        )}
      </div>
      {longText && <ShowMoreButton expanded={expanded} onToggle={() => setExpanded((v) => !v)} />}
    </div>
  );
}
