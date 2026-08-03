import { apiFetchBlob } from "@/lib/api-client";

/** Trigger a browser download from a Blob. */
export function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Practical computed-style subset for Tailwind / flex / grid studio UIs. */
const PDF_STYLE_PROPS = [
  "display",
  "position",
  "top",
  "right",
  "bottom",
  "left",
  "inset",
  "float",
  "clear",
  "width",
  "height",
  "min-width",
  "min-height",
  "max-width",
  "max-height",
  "margin",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "padding",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "border",
  "border-top",
  "border-right",
  "border-bottom",
  "border-left",
  "border-width",
  "border-style",
  "border-color",
  "border-radius",
  "border-top-left-radius",
  "border-top-right-radius",
  "border-bottom-right-radius",
  "border-bottom-left-radius",
  "background",
  "background-color",
  "background-image",
  "background-size",
  "background-position",
  "background-repeat",
  "background-clip",
  "color",
  "opacity",
  "visibility",
  "font",
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "font-variant",
  "line-height",
  "letter-spacing",
  "word-spacing",
  "text-align",
  "text-decoration",
  "text-decoration-line",
  "text-decoration-color",
  "text-decoration-style",
  "text-transform",
  "text-overflow",
  "text-shadow",
  "white-space",
  "word-break",
  "overflow-wrap",
  "vertical-align",
  "flex",
  "flex-direction",
  "flex-wrap",
  "flex-grow",
  "flex-shrink",
  "flex-basis",
  "align-items",
  "align-content",
  "align-self",
  "justify-content",
  "justify-items",
  "justify-self",
  "gap",
  "row-gap",
  "column-gap",
  "order",
  "grid",
  "grid-template-columns",
  "grid-template-rows",
  "grid-template-areas",
  "grid-auto-flow",
  "grid-auto-columns",
  "grid-auto-rows",
  "grid-column",
  "grid-row",
  "grid-area",
  "overflow",
  "overflow-x",
  "overflow-y",
  "object-fit",
  "object-position",
  "box-sizing",
  "box-shadow",
  "filter",
  "backdrop-filter",
  "transform",
  "transform-origin",
  "transform-style",
  "perspective",
  "z-index",
  "clip-path",
  "outline",
  "outline-offset",
  "list-style",
  "table-layout",
  "border-collapse",
  "border-spacing",
  "aspect-ratio",
  "isolation",
  "mix-blend-mode",
  "pointer-events",
  "user-select",
  "cursor",
  "fill",
  "stroke",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-dasharray",
  "stroke-dashoffset",
] as const;

function tryImageToDataUrl(img: HTMLImageElement): string | null {
  try {
    if (!img.naturalWidth || !img.naturalHeight) return null;
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

function absolutizeUrl(url: string): string {
  if (!url) return url;
  if (
    url.startsWith("data:") ||
    url.startsWith("blob:") ||
    /^https?:\/\//i.test(url) ||
    url.startsWith("//")
  ) {
    if (url.startsWith("//")) return `${window.location.protocol}${url}`;
    return url;
  }
  try {
    return new URL(url, window.location.href).href;
  } catch {
    if (url.startsWith("/")) return `${window.location.origin}${url}`;
    return url;
  }
}

function applyComputedStyles(src: Element, dst: Element) {
  if (!(dst instanceof HTMLElement || dst instanceof SVGElement)) return;
  if (!(src instanceof Element)) return;
  const computed = window.getComputedStyle(src);
  for (const prop of PDF_STYLE_PROPS) {
    const value = computed.getPropertyValue(prop);
    if (value) dst.style.setProperty(prop, value);
  }
}

/**
 * Deep-clone an element with computed styles inlined so Puppeteer can render
 * Tailwind (and other stylesheet-driven) UIs without the app CSS bundle.
 */
export function serializeElementForPdf(el: HTMLElement): string {
  const clone = el.cloneNode(true) as HTMLElement;
  const srcEls = [el, ...Array.from(el.querySelectorAll("*"))];
  const dstEls = [clone, ...Array.from(clone.querySelectorAll("*"))];

  for (let i = 0; i < srcEls.length; i++) {
    const src = srcEls[i];
    const dst = dstEls[i];
    if (!dst) continue;

    applyComputedStyles(src, dst);

    if (src instanceof HTMLImageElement && dst instanceof HTMLImageElement) {
      const raw = src.currentSrc || src.getAttribute("src") || src.src || "";
      if (raw.startsWith("blob:") || raw.startsWith("data:")) {
        const dataUrl = tryImageToDataUrl(src);
        if (dataUrl) {
          dst.setAttribute("src", dataUrl);
          dst.removeAttribute("srcset");
        } else if (raw.startsWith("data:")) {
          dst.setAttribute("src", raw);
        }
      } else if (raw) {
        dst.setAttribute("src", absolutizeUrl(raw));
        dst.removeAttribute("srcset");
      }
    }

    if (src instanceof HTMLElement && dst instanceof HTMLElement) {
      const bg = window.getComputedStyle(src).backgroundImage;
      if (bg && bg !== "none" && bg.includes("url(")) {
        dst.style.backgroundImage = bg.replace(
          /url\((['"]?)([^)'"]+)\1\)/g,
          (_m, _q, u: string) => `url("${absolutizeUrl(u)}")`
        );
      }
    }

    if (src instanceof SVGImageElement && dst instanceof SVGImageElement) {
      const href =
        src.getAttribute("href") ||
        src.getAttributeNS("http://www.w3.org/1999/xlink", "href") ||
        "";
      if (href) {
        const abs = absolutizeUrl(href);
        dst.setAttribute("href", abs);
        dst.setAttributeNS("http://www.w3.org/1999/xlink", "href", abs);
      }
    }
  }

  return clone.outerHTML;
}

/** Export studio HTML pages as a Puppeteer-rendered PDF download. */
export async function exportHtmlPagesPdf(opts: {
  pages: string[];
  widthPx: number;
  heightPx: number;
  filename: string;
  extraCss?: string;
}): Promise<void> {
  const blob = await apiFetchBlob("/reports/html-pages-pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      pages: opts.pages,
      widthPx: opts.widthPx,
      heightPx: opts.heightPx,
      filename: opts.filename,
      extraCss: opts.extraCss,
    }),
  });
  triggerBlobDownload(blob, opts.filename.endsWith(".pdf") ? opts.filename : `${opts.filename}.pdf`);
}

/**
 * Open a PDF blob in a hidden iframe and trigger the browser print dialog.
 * Uses the same Puppeteer-rendered PDF as download, so print matches export.
 */
export async function printPdfBlob(blob: Blob): Promise<void> {
  const pdfBlob =
    blob.type === "application/pdf" ? blob : new Blob([blob], { type: "application/pdf" });
  const url = URL.createObjectURL(pdfBlob);

  const tryIframePrint = () =>
    new Promise<void>((resolve, reject) => {
      const iframe = document.createElement("iframe");
      iframe.setAttribute("title", "Print document");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      iframe.style.opacity = "0";
      iframe.style.pointerEvents = "none";

      let settled = false;
      const finish = (err?: Error) => {
        if (settled) return;
        settled = true;
        if (err) {
          iframe.remove();
          reject(err);
        } else {
          resolve();
          window.setTimeout(() => {
            iframe.remove();
            URL.revokeObjectURL(url);
          }, 60_000);
        }
      };

      iframe.onload = () => {
        window.setTimeout(() => {
          try {
            const win = iframe.contentWindow;
            if (!win) throw new Error("Print frame unavailable");
            win.focus();
            win.print();
            finish();
          } catch (e) {
            finish(e instanceof Error ? e : new Error("Print failed"));
          }
        }, 400);
      };

      iframe.onerror = () => {
        finish(new Error("Failed to load PDF for printing"));
      };

      iframe.src = url;
      document.body.appendChild(iframe);
    });

  try {
    await tryIframePrint();
  } catch {
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    if (!opened) {
      URL.revokeObjectURL(url);
      throw new Error("Popup blocked — allow popups to print, or use Download instead.");
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}

/** Download invoice PDF via Puppeteer server export. */
export async function downloadInvoicePdf(id: string, filename?: string) {
  const blob = await apiFetchBlob(`/invoices/${encodeURIComponent(id)}/export-pdf`);
  triggerBlobDownload(blob, filename || `${id}.pdf`);
  return blob;
}

/** Download proforma PDF via Puppeteer server export. */
export async function downloadProformaPdf(id: string, filename?: string) {
  const blob = await apiFetchBlob(`/proformas/${encodeURIComponent(id)}/export-pdf`);
  triggerBlobDownload(blob, filename || `${id}.pdf`);
  return blob;
}

/** Print invoice using the same Puppeteer PDF as download. */
export async function printInvoicePdf(id: string) {
  const blob = await apiFetchBlob(`/invoices/${encodeURIComponent(id)}/export-pdf`);
  await printPdfBlob(blob);
  return blob;
}

/** Print proforma using the same Puppeteer PDF as download. */
export async function printProformaPdf(id: string) {
  const blob = await apiFetchBlob(`/proformas/${encodeURIComponent(id)}/export-pdf`);
  await printPdfBlob(blob);
  return blob;
}

/** Download HR document PDF via Puppeteer server export. */
export async function downloadHrDocumentPdf(id: string, filename?: string) {
  const blob = await apiFetchBlob(`/hr/documents/${encodeURIComponent(id)}/export-pdf`);
  triggerBlobDownload(blob, filename || `${id}.pdf`);
  return blob;
}
