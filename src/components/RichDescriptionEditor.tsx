import { useRef, useState, useCallback, useEffect } from "react";
import { Bold, Italic, Underline } from "lucide-react";

interface RichDescriptionEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
}

interface ToolbarState {
  visible: boolean;
  top: number;
  left: number;
}

/**
 * A contentEditable description field with a floating Bold / Italic / Underline
 * toolbar that appears whenever the user selects text.
 *
 * Stores and emits raw HTML so bold/italic/underline survive a round-trip.
 */
export function RichDescriptionEditor({
  value,
  onChange,
  placeholder = "Service description",
  className = "",
}: RichDescriptionEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const savedSelectionRef = useRef<Range | null>(null);

  const [toolbar, setToolbar] = useState<ToolbarState>({ visible: false, top: 0, left: 0 });
  const [boldActive, setBoldActive] = useState(false);
  const [italicActive, setItalicActive] = useState(false);
  const [underlineActive, setUnderlineActive] = useState(false);

  const lastEmittedValue = useRef<string | null>(null);

  // Sync the editor with external value changes (e.g. data loaded asynchronously)
  useEffect(() => {
    if (editorRef.current && value !== lastEmittedValue.current) {
      editorRef.current.innerHTML = value || "";
      lastEmittedValue.current = value;
    }
  }, [value]);

  const updateFormatState = useCallback(() => {
    setBoldActive(document.queryCommandState("bold"));
    setItalicActive(document.queryCommandState("italic"));
    setUnderlineActive(document.queryCommandState("underline"));
  }, []);

  const handleSelectionChange = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
      setToolbar(t => ({ ...t, visible: false }));
      return;
    }

    const range = sel.getRangeAt(0);
    if (!editorRef.current?.contains(range.commonAncestorContainer)) {
      setToolbar(t => ({ ...t, visible: false }));
      return;
    }

    savedSelectionRef.current = range.cloneRange();

    const rect = range.getBoundingClientRect();
    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect) return;

    const toolbarWidth = 130;
    let left = rect.left - containerRect.left + rect.width / 2 - toolbarWidth / 2;
    left = Math.max(0, Math.min(left, containerRect.width - toolbarWidth));

    setToolbar({
      visible: true,
      top: rect.top - containerRect.top - 44,
      left,
    });
    updateFormatState();
  }, [updateFormatState]);

  useEffect(() => {
    document.addEventListener("selectionchange", handleSelectionChange);
    return () => document.removeEventListener("selectionchange", handleSelectionChange);
  }, [handleSelectionChange]);

  const restoreSelection = () => {
    if (savedSelectionRef.current) {
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(savedSelectionRef.current);
    }
  };

  const execFormat = (command: string) => {
    restoreSelection();
    document.execCommand(command, false);
    updateFormatState();
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      lastEmittedValue.current = html;
      onChange(html);
    }
    setTimeout(handleSelectionChange, 0);
  };

  const handleInput = () => {
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      lastEmittedValue.current = html;
      onChange(html);
    }
  };

  const handleBlur = () => {
    setTimeout(() => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) {
        setToolbar(t => ({ ...t, visible: false }));
      }
    }, 200);
  };

  const ToolbarButton = ({
    active,
    onClick,
    children,
    title: btnTitle,
  }: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
    title: string;
  }) => (
    <button
      type="button"
      title={btnTitle}
      onMouseDown={(e) => {
        e.preventDefault(); // prevent blur
        onClick();
      }}
      className={`h-7 w-7 flex items-center justify-center rounded transition-colors text-xs font-bold
        ${active
          ? "bg-white text-gray-900"
          : "text-white/80 hover:bg-white/20 hover:text-white"
        }`}
    >
      {children}
    </button>
  );

  return (
    <div ref={containerRef} className="relative" style={{ isolation: "isolate" }}>
      {/* Floating toolbar */}
      {toolbar.visible && (
        <div
          className="absolute z-50 flex items-center gap-0.5 px-1.5 py-1 rounded-lg shadow-xl"
          style={{
            top: toolbar.top,
            left: toolbar.left,
            background: "hsl(222.2 84% 18%)",
            border: "1px solid rgba(255,255,255,0.12)",
            backdropFilter: "blur(8px)",
            minWidth: 130,
          }}
        >
          <ToolbarButton active={boldActive} onClick={() => execFormat("bold")} title="Bold (Ctrl+B)">
            <Bold className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton active={italicActive} onClick={() => execFormat("italic")} title="Italic (Ctrl+I)">
            <Italic className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton active={underlineActive} onClick={() => execFormat("underline")} title="Underline (Ctrl+U)">
            <Underline className="h-3.5 w-3.5" />
          </ToolbarButton>
          {/* Arrow */}
          <div
            className="absolute"
            style={{
              bottom: -5,
              left: "50%",
              transform: "translateX(-50%)",
              width: 0,
              height: 0,
              borderLeft: "5px solid transparent",
              borderRight: "5px solid transparent",
              borderTop: "5px solid hsl(222.2 84% 18%)",
            }}
          />
        </div>
      )}

      {/* The editable area */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onBlur={handleBlur}
        data-placeholder={placeholder}
        className={`
          min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2
          text-sm text-foreground leading-relaxed cursor-text
          focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
          [&:empty]:before:content-[attr(data-placeholder)]
          [&:empty]:before:text-muted-foreground
          [&:empty]:before:pointer-events-none
          ${className}
        `}
      />
    </div>
  );
}
