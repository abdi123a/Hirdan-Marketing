import { useState, useMemo } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

function parseEmailHtml(htmlString: string): { mainHtml: string; quotedHtml: string | null } {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');

    // 1. Check for standard quote elements
    const quoteSelector = 'blockquote, .gmail_quote, .gmail_extra, #divRplyFwdMsg, #appendonsend, .yahoo_quoted, [type="cite"]';
    const quoteEl = doc.querySelector(quoteSelector);

    if (quoteEl && quoteEl.parentNode) {
      const quotedHtml = quoteEl.outerHTML;
      quoteEl.remove();
      const mainHtml = doc.body.innerHTML.trim();
      if (mainHtml && mainHtml !== '<br>') {
        return { mainHtml, quotedHtml };
      }
    }

    // 2. Check for text dividers
    const allElements = Array.from(doc.body.querySelectorAll('div, p, hr, table, span'));
    for (const el of allElements) {
      const text = (el.textContent || '').trim();
      const isDivider =
        text.includes('---------- Forwarded message ----------') ||
        text.includes('-----Original Message-----') ||
        /^(On\s+.+wrote:)$/im.test(text) ||
        /^(From:\s+.+Sent:)/im.test(text);

      if (isDivider) {
        const siblings: Element[] = [];
        let curr: Element | null = el;
        while (curr) {
          siblings.push(curr);
          curr = curr.nextElementSibling;
        }
        const container = doc.createElement('div');
        siblings.forEach((s) => container.appendChild(s));
        const quotedHtml = container.innerHTML;
        const mainHtml = doc.body.innerHTML.trim();
        if (mainHtml && mainHtml !== '<br>') {
          return { mainHtml, quotedHtml };
        }
      }
    }
  } catch (err) {
    console.error('Error parsing email HTML:', err);
  }

  return { mainHtml: htmlString, quotedHtml: null };
}

function parseEmailText(textString: string): { mainText: string; quotedText: string | null } {
  const lines = textString.split('\n');
  const quoteStartIdx = lines.findIndex((line) => {
    const trimmed = line.trim();
    return (
      trimmed.startsWith('>') ||
      trimmed.includes('---------- Forwarded message ----------') ||
      trimmed.includes('-----Original Message-----') ||
      /^(On\s+.+wrote:)$/i.test(trimmed)
    );
  });

  if (quoteStartIdx > 0) {
    const mainText = lines.slice(0, quoteStartIdx).join('\n').trim();
    const quotedText = lines.slice(quoteStartIdx).join('\n').trim();
    if (mainText) {
      return { mainText, quotedText };
    }
  }

  return { mainText: textString, quotedText: null };
}

interface ParsedEmail {
  mainHtml: string;
  mainText: string | null;
  quotedHtml: string | null;
  quotedText: string | null;
}

interface Props {
  html?: string | null;
  text?: string | null;
}

export function EmailBody({ html, text }: Props) {
  const [showQuoted, setShowQuoted] = useState(false);

  const parsed: ParsedEmail = useMemo(() => {
    if (html) {
      const p = parseEmailHtml(html);
      return { mainHtml: p.mainHtml, mainText: null, quotedHtml: p.quotedHtml, quotedText: null };
    }
    if (text) {
      const p = parseEmailText(text);
      return { mainHtml: '', mainText: p.mainText, quotedHtml: null, quotedText: p.quotedText };
    }
    return { mainHtml: '', mainText: '', quotedHtml: null, quotedText: null };
  }, [html, text]);

  const hasQuoted = Boolean(parsed.quotedHtml || parsed.quotedText);

  return (
    <div className="email-body-container space-y-2 overflow-x-auto max-w-full break-words">
      {html ? (
        <div
          className="email-html prose prose-sm max-w-none dark:prose-invert overflow-x-auto [&_table]:max-w-full [&_img]:max-w-full [&_img]:h-auto"
          dangerouslySetInnerHTML={{ __html: parsed.mainHtml || html }}
        />
      ) : (
        <pre className="whitespace-pre-wrap font-sans text-sm break-words overflow-x-auto">{parsed.mainText || text}</pre>
      )}

      {hasQuoted && (
        <div className="pt-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowQuoted((v) => !v);
            }}
            className={cn(
              'inline-flex items-center justify-center rounded-md border bg-muted/60 px-2 py-0.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none',
              showQuoted && 'bg-accent text-foreground'
            )}
            title={showQuoted ? 'Hide trimmed content' : 'Show trimmed content'}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>

          {showQuoted && (
            <div className="mt-2 rounded-lg border border-dashed bg-muted/20 p-3">
              {parsed.quotedHtml ? (
                <div
                  className="email-html prose prose-sm max-w-none opacity-80 dark:prose-invert"
                  dangerouslySetInnerHTML={{ __html: parsed.quotedHtml }}
                />
              ) : (
                <pre className="whitespace-pre-wrap font-sans text-xs opacity-80">{parsed.quotedText}</pre>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
