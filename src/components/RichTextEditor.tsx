import { useRef, RefObject } from "react";
import {
  Bold, Italic, Underline, Strikethrough,
  List, ListOrdered, Link, Undo2, Redo2, ChevronDown,
  AlignLeft, Indent, Outdent,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface RichTextEditorProps {
  editorRef: RefObject<HTMLDivElement | null>;
  onChange?: (html: string) => void;
  disabled?: boolean;
  minHeight?: string;
  maxHeight?: string;
  placeholder?: string;
  className?: string;
}

// ─── Data ────────────────────────────────────────────────────────────────────

const FONT_FAMILIES = [
  { label: "Sans Serif", value: "Arial, sans-serif" },
  { label: "Serif", value: "Georgia, serif" },
  { label: "Monospace", value: "'Courier New', monospace" },
  { label: "Cursive", value: "cursive" },
];

const FONT_SIZES = [
  { label: "Small", value: "1" },
  { label: "Normal", value: "3" },
  { label: "Large", value: "5" },
  { label: "Huge", value: "7" },
];

const ALIGNMENTS = [
  { label: "Left", value: "justifyLeft" },
  { label: "Center", value: "justifyCenter" },
  { label: "Right", value: "justifyRight" },
  { label: "Justify", value: "justifyFull" },
];

// ─── Sub-components ──────────────────────────────────────────────────────────

function TBtn({
  onClick, title, disabled = false, children,
}: {
  onClick: (e: React.MouseEvent) => void;
  title: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onMouseDown={(e) => { e.preventDefault(); onClick(e); }}
      className={`h-7 min-w-[28px] px-1.5 flex items-center justify-center rounded-md transition-all text-sm select-none
        hover:bg-accent text-muted-foreground hover:text-foreground
        ${disabled ? "opacity-40 cursor-not-allowed pointer-events-none" : "cursor-pointer"}
      `}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <div className="w-px h-5 bg-border mx-0.5 shrink-0" />;
}

function TDropdown({
  label, items, onSelect, disabled = false, width = "w-28",
}: {
  label: string;
  items: { label: string; value: string }[];
  onSelect: (value: string) => void;
  disabled?: boolean;
  width?: string;
}) {
  return (
    <div className={`relative group ${disabled ? "opacity-40 pointer-events-none" : ""}`}>
      <button
        type="button"
        disabled={disabled}
        onMouseDown={(e) => e.preventDefault()}
        className={`h-7 px-2 flex items-center gap-1 rounded-md text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-all cursor-pointer ${width}`}
      >
        <span className="truncate flex-1 text-left text-[11px]">{label}</span>
        <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
      </button>
      <div className="absolute top-full left-0 mt-1 bg-popover border border-border rounded-xl shadow-xl z-[100] py-1 overflow-hidden hidden group-hover:block min-w-[130px]">
        {items.map((item) => (
          <button
            key={item.value}
            type="button"
            onMouseDown={(e) => { e.preventDefault(); onSelect(item.value); }}
            className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent text-foreground transition-colors"
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function RichTextEditor({
  editorRef,
  onChange,
  disabled = false,
  minHeight = "100px",
  maxHeight = "200px",
  placeholder = "Write something...",
  className = "",
}: RichTextEditorProps) {
  const colorInputRef = useRef<HTMLInputElement>(null);

  const exec = (command: string, value?: string) => {
    if (disabled) return;
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    onChange?.(editorRef.current?.innerHTML || "");
  };

  const handleInsertLink = () => {
    const url = window.prompt("Enter the URL to link:");
    if (url) {
      exec("createLink", url.startsWith("http") ? url : `https://${url}`);
    }
    editorRef.current?.focus();
  };

  return (
    <div className={`border border-border/60 rounded-xl overflow-hidden ${className}`}>
      {/* ── Toolbar ── */}
      <div className={`flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-border/50 bg-muted/40 ${disabled ? "opacity-50 pointer-events-none" : ""}`}>

        {/* Undo / Redo */}
        <TBtn title="Undo" onClick={() => exec("undo")} disabled={disabled}><Undo2 className="h-3.5 w-3.5" /></TBtn>
        <TBtn title="Redo" onClick={() => exec("redo")} disabled={disabled}><Redo2 className="h-3.5 w-3.5" /></TBtn>

        <Sep />

        {/* Font Family */}
        <TDropdown
          label="Sans Serif"
          items={FONT_FAMILIES}
          width="w-[100px]"
          disabled={disabled}
          onSelect={(val) => { exec("fontName", val); }}
        />

        <Sep />

        {/* Font Size */}
        <TDropdown
          label="Size"
          items={FONT_SIZES}
          width="w-16"
          disabled={disabled}
          onSelect={(val) => exec("fontSize", val)}
        />

        <Sep />

        {/* Bold / Italic / Underline / Strikethrough */}
        <TBtn title="Bold (Ctrl+B)" onClick={() => exec("bold")} disabled={disabled}><Bold className="h-3.5 w-3.5" /></TBtn>
        <TBtn title="Italic (Ctrl+I)" onClick={() => exec("italic")} disabled={disabled}><Italic className="h-3.5 w-3.5" /></TBtn>
        <TBtn title="Underline (Ctrl+U)" onClick={() => exec("underline")} disabled={disabled}><Underline className="h-3.5 w-3.5" /></TBtn>
        <TBtn title="Strikethrough" onClick={() => exec("strikeThrough")} disabled={disabled}><Strikethrough className="h-3.5 w-3.5" /></TBtn>

        {/* Text Color */}
        <TBtn title="Text Color" onClick={() => colorInputRef.current?.click()} disabled={disabled}>
          <div className="flex flex-col items-center gap-[2px]">
            <span className="text-[11px] font-bold leading-none" style={{ fontFamily: "Georgia, serif" }}>A</span>
            <div className="h-[3px] w-[14px] rounded-sm" style={{ background: "linear-gradient(90deg,#ef4444,#f97316,#eab308,#22c55e,#3b82f6,#8b5cf6)" }} />
          </div>
        </TBtn>
        <input
          ref={colorInputRef}
          type="color"
          defaultValue="#000000"
          className="sr-only"
          onChange={(e) => exec("foreColor", e.target.value)}
          tabIndex={-1}
        />

        <Sep />

        {/* Alignment */}
        <TDropdown
          label="Align"
          items={ALIGNMENTS}
          width="w-16"
          disabled={disabled}
          onSelect={(val) => exec(val)}
        />

        <Sep />

        {/* Lists */}
        <TBtn title="Numbered List" onClick={() => exec("insertOrderedList")} disabled={disabled}><ListOrdered className="h-3.5 w-3.5" /></TBtn>
        <TBtn title="Bullet List" onClick={() => exec("insertUnorderedList")} disabled={disabled}><List className="h-3.5 w-3.5" /></TBtn>

        <Sep />

        {/* Indent */}
        <TBtn title="Decrease Indent" onClick={() => exec("outdent")} disabled={disabled}><Outdent className="h-3.5 w-3.5" /></TBtn>
        <TBtn title="Increase Indent" onClick={() => exec("indent")} disabled={disabled}><Indent className="h-3.5 w-3.5" /></TBtn>

        <Sep />

        {/* Link */}
        <TBtn title="Insert Link" onClick={handleInsertLink} disabled={disabled}><Link className="h-3.5 w-3.5" /></TBtn>

      </div>

      {/* ── Editor Area ── */}
      <div
        ref={editorRef}
        contentEditable={!disabled}
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={() => onChange?.(editorRef.current?.innerHTML || "")}
        className={`w-full focus:outline-none px-4 py-3 text-sm text-foreground leading-relaxed overflow-y-auto bg-muted/20 focus:bg-card transition-colors
          empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground/50 empty:before:text-sm empty:before:pointer-events-none
          ${disabled ? "opacity-50 cursor-not-allowed" : ""}
        `}
        style={{ minHeight, maxHeight, wordBreak: "break-word" }}
      />
    </div>
  );
}
