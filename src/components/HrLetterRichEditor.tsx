import { useRef, useState, useCallback, useEffect, type ReactNode } from "react";
import { Bold, Italic, Underline, List, ListOrdered } from "lucide-react";
import { cn } from "@/lib/utils";

interface HrLetterRichEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
  className?: string;
}

/**
 * Compact rich-text editor for HR letter bodies.
 * Always-visible Bold / Italic / Underline (+ lists) toolbar.
 * Emits HTML so formatting survives preview + PDF.
 */
export function HrLetterRichEditor({
  value,
  onChange,
  placeholder = "Write the document text…",
  minHeight = "180px",
  className,
}: HrLetterRichEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastEmitted = useRef<string | null>(null);
  const [boldActive, setBoldActive] = useState(false);
  const [italicActive, setItalicActive] = useState(false);
  const [underlineActive, setUnderlineActive] = useState(false);

  useEffect(() => {
    if (editorRef.current && value !== lastEmitted.current) {
      editorRef.current.innerHTML = value || "";
      lastEmitted.current = value;
    }
  }, [value]);

  const updateFormatState = useCallback(() => {
    setBoldActive(document.queryCommandState("bold"));
    setItalicActive(document.queryCommandState("italic"));
    setUnderlineActive(document.queryCommandState("underline"));
  }, []);

  const emit = () => {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML;
    lastEmitted.current = html;
    onChange(html);
  };

  const exec = (command: string, arg?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, arg);
    updateFormatState();
    emit();
  };

  const ToolbarButton = ({
    active,
    onClick,
    children,
    title,
  }: {
    active?: boolean;
    onClick: () => void;
    children: ReactNode;
    title: string;
  }) => (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      className={cn(
        "h-7 w-7 flex items-center justify-center rounded-md transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {children}
    </button>
  );

  return (
    <div className={cn("rounded-lg border border-input bg-background overflow-hidden", className)}>
      <div className="flex flex-wrap items-center gap-0.5 px-1.5 py-1 border-b border-border/60 bg-muted/30">
        <ToolbarButton active={boldActive} onClick={() => exec("bold")} title="Bold (Ctrl+B)">
          <Bold className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton active={italicActive} onClick={() => exec("italic")} title="Italic (Ctrl+I)">
          <Italic className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton active={underlineActive} onClick={() => exec("underline")} title="Underline (Ctrl+U)">
          <Underline className="h-3.5 w-3.5" />
        </ToolbarButton>
        <div className="w-px h-4 bg-border mx-1" />
        <ToolbarButton onClick={() => exec("insertUnorderedList")} title="Bullet list">
          <List className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => exec("insertOrderedList")} title="Numbered list">
          <ListOrdered className="h-3.5 w-3.5" />
        </ToolbarButton>
      </div>

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        onKeyUp={updateFormatState}
        onMouseUp={updateFormatState}
        data-placeholder={placeholder}
        className={cn(
          "w-full px-3 py-2 text-xs leading-relaxed cursor-text outline-none",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
          "[&:empty]:before:content-[attr(data-placeholder)]",
          "[&:empty]:before:text-muted-foreground",
          "[&:empty]:before:pointer-events-none",
          "[&_p]:mb-2 [&_p:last-child]:mb-0",
          "[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-2",
          "[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-2",
          "[&_strong]:font-bold [&_b]:font-bold",
          "[&_em]:italic [&_i]:italic",
          "[&_u]:underline"
        )}
        style={{ minHeight }}
      />
    </div>
  );
}
