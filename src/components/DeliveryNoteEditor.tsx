import { useRef, useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Truck, Bold, Italic, Underline } from "lucide-react";

interface DeliveryNoteEditorProps {
  enabled: boolean;
  title: string;
  content: string;
  onEnabledChange: (v: boolean) => void;
  onTitleChange: (v: string) => void;
  onContentChange: (v: string) => void;
}

interface ToolbarState {
  visible: boolean;
  top: number;
  left: number;
}

export function DeliveryNoteEditor({
  enabled,
  title,
  content,
  onEnabledChange,
  onTitleChange,
  onContentChange,
}: DeliveryNoteEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [toolbar, setToolbar] = useState<ToolbarState>({ visible: false, top: 0, left: 0 });
  const [boldActive, setBoldActive] = useState(false);
  const [italicActive, setItalicActive] = useState(false);
  const [underlineActive, setUnderlineActive] = useState(false);
  const savedSelectionRef = useRef<Range | null>(null);

  // Sync content into the editor when it changes externally (e.g. initial load)
  const initialised = useRef(false);
  useEffect(() => {
    if (editorRef.current && !initialised.current) {
      editorRef.current.innerHTML = content || "";
      initialised.current = true;
    }
  }, [content]);

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

    // Only show toolbar if selection is inside our editor
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
      onContentChange(editorRef.current.innerHTML);
    }
    // Recompute selection after format
    setTimeout(handleSelectionChange, 0);
  };

  const handleInput = () => {
    if (editorRef.current) {
      onContentChange(editorRef.current.innerHTML);
    }
  };

  const handleBlur = () => {
    // Delay to allow toolbar button clicks to register
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
        e.preventDefault(); // Prevent blur
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
    <Card className="shadow-card border-border text-foreground">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Truck className="h-4 w-4 text-primary" />
            Delivery Note
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {enabled ? "Visible on document" : "Hidden"}
            </span>
            <Switch
              id="delivery-note-switch"
              checked={enabled}
              onCheckedChange={onEnabledChange}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Add a delivery note to your document. Highlight text in the description to bold or italicize it.
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="delivery-note-title" className="text-sm font-semibold">
            Title <span className="text-muted-foreground font-normal">(appears bold)</span>
          </Label>
          <Input
            id="delivery-note-title"
            placeholder="e.g. Delivery Terms"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            className="font-semibold"
            disabled={!enabled}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm font-semibold">
            Description{" "}
            <span className="text-muted-foreground font-normal">
              (highlight text to format)
            </span>
          </Label>

          {/* Editor container — position:relative so the toolbar is anchored to it */}
          <div
            ref={containerRef}
            className="relative"
            style={{ isolation: "isolate" }}
          >
            {/* Floating Formatting Toolbar */}
            {toolbar.visible && enabled && (
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
                <ToolbarButton
                  active={boldActive}
                  onClick={() => execFormat("bold")}
                  title="Bold (Ctrl+B)"
                >
                  <Bold className="h-3.5 w-3.5" />
                </ToolbarButton>
                <ToolbarButton
                  active={italicActive}
                  onClick={() => execFormat("italic")}
                  title="Italic (Ctrl+I)"
                >
                  <Italic className="h-3.5 w-3.5" />
                </ToolbarButton>
                <ToolbarButton
                  active={underlineActive}
                  onClick={() => execFormat("underline")}
                  title="Underline (Ctrl+U)"
                >
                  <Underline className="h-3.5 w-3.5" />
                </ToolbarButton>
                {/* Indicator arrow */}
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

            <div
              ref={editorRef}
              contentEditable={enabled}
              suppressContentEditableWarning
              onInput={handleInput}
              onBlur={handleBlur}
              data-placeholder="e.g. Delivery will be completed within 5–7 business days after full payment confirmation."
              className={`
                min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2
                text-sm text-foreground leading-relaxed
                focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
                ${!enabled ? "opacity-50 cursor-not-allowed select-none" : "cursor-text"}
                [&:empty]:before:content-[attr(data-placeholder)]
                [&:empty]:before:text-muted-foreground
              `}
            />
          </div>
        </div>

        {enabled && (
          <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 bg-muted/40 rounded-lg px-3 py-2">
            <Truck className="h-3 w-3 shrink-0 text-primary" />
            This note will appear on the printed document between the line items and the payment method section.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
