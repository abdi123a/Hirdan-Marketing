import React, { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { WebView, type WebViewProps } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { radius, spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';

interface WebViewBridge {
  injectJavaScript: (script: string) => void;
}

/**
 * The published WebView type omits its ref, so re-type it here to reach
 * `injectJavaScript`, which is how the toolbar drives the document.
 */
const BridgedWebView = WebView as unknown as React.ComponentType<
  WebViewProps & { ref?: React.Ref<WebViewBridge> }
>;

export interface RichTextEditorHandle {
  /** Latest HTML the WebView has reported (may lag the last keystroke). */
  getHtml: () => string;
  /**
   * Ask the WebView for the live body and wait for it. Call this before send /
   * save so a native Send tap that blurs the editor cannot race past the
   * asynchronous `postMessage` sync and ship an empty body.
   */
  flushHtml: () => Promise<string>;
  setHtml: (html: string) => void;
  /** Append HTML after the current body, e.g. when inserting a template. */
  appendHtml: (html: string) => void;
  focus: () => void;
  clear: () => void;
}

interface Props {
  placeholder?: string;
  minHeight?: number;
  maxHeight?: number;
  initialHtml?: string;
  onChange?: (html: string) => void;
}

type Command =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strikeThrough'
  | 'insertUnorderedList'
  | 'insertOrderedList'
  | 'outdent'
  | 'indent'
  | 'justifyLeft'
  | 'justifyCenter'
  | 'undo'
  | 'redo'
  | 'removeFormat';

const TOOLBAR: { command: Command; icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { command: 'bold', icon: 'text', label: 'Bold' },
  { command: 'italic', icon: 'text-outline', label: 'Italic' },
  { command: 'insertUnorderedList', icon: 'list-outline', label: 'Bullet list' },
  { command: 'insertOrderedList', icon: 'list-circle-outline', label: 'Numbered list' },
  { command: 'outdent', icon: 'chevron-back-outline', label: 'Outdent' },
  { command: 'indent', icon: 'chevron-forward-outline', label: 'Indent' },
  { command: 'justifyLeft', icon: 'reorder-three-outline', label: 'Align left' },
  { command: 'justifyCenter', icon: 'reorder-four-outline', label: 'Align center' },
  { command: 'undo', icon: 'arrow-undo-outline', label: 'Undo' },
  { command: 'redo', icon: 'arrow-redo-outline', label: 'Redo' },
  { command: 'removeFormat', icon: 'ban-outline', label: 'Clear formatting' },
];

const FLUSH_TIMEOUT_MS = 900;

function buildDocument(initialHtml: string, placeholder: string): string {
  // The seed body is embedded as a JSON string so quotes and newlines survive.
  const seed = JSON.stringify(initialHtml || '');
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>
  html,body{margin:0;padding:0;background:#ffffff;-webkit-text-size-adjust:100%;}
  #editor{
    padding:12px 14px;outline:none;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
    font-size:15px;line-height:1.6;color:#1f2937;word-break:break-word;
  }
  #editor:empty:before{content:attr(data-placeholder);color:#9ca3af;pointer-events:none;}
  #editor img{max-width:100%;height:auto;}
  blockquote{border-left:3px solid #e2e8f0;margin:0;padding-left:12px;color:#475569;}
  a{color:#2563eb;}
</style>
</head>
<body>
<div id="editor" contenteditable="true" data-placeholder="${placeholder.replace(/"/g, '&quot;')}"></div>
<script>
  var editor = document.getElementById('editor');
  editor.innerHTML = ${seed};

  function send(type, payload, requestId) {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: type,
      payload: payload,
      requestId: requestId || null
    }));
  }
  function measure() {
    send('height', String(Math.max(document.documentElement.scrollHeight, editor.scrollHeight) + 8));
  }
  function sync() { send('html', editor.innerHTML); measure(); }

  editor.addEventListener('input', sync);
  editor.addEventListener('focus', function () { send('focus', ''); });
  editor.addEventListener('blur', function () { send('blur', ''); sync(); });

  // Paste as plain text so foreign styles never leak into the message body.
  editor.addEventListener('paste', function (e) {
    e.preventDefault();
    var text = (e.clipboardData || window.clipboardData).getData('text/plain');
    document.execCommand('insertText', false, text);
  });

  window.editorApi = {
    exec: function (command, value) {
      editor.focus();
      document.execCommand(command, false, value);
      sync();
    },
    setHtml: function (html) { editor.innerHTML = html; sync(); },
    appendHtml: function (html) {
      var existing = editor.innerHTML.trim();
      editor.innerHTML = existing && existing !== '<br>' ? existing + '<br/>' + html : html;
      sync();
    },
    // Synchronous read for send/save — pairs with flushHtml on the native side.
    flush: function (requestId) {
      send('html-flush', editor.innerHTML, requestId);
      measure();
    },
    focus: function () { editor.focus(); }
  };

  if (window.ResizeObserver) new ResizeObserver(measure).observe(editor);
  sync();
</script>
</body>
</html>`;
}

/**
 * HTML composer backed by a WebView, so replies and new messages carry the same
 * rich body the web Email Center produces. The toolbar is native and drives the
 * document through injected `execCommand` calls. The frame grows with its
 * content instead of scrolling, which keeps it usable inside a parent ScrollView.
 */
export const RichTextEditor = forwardRef<RichTextEditorHandle, Props>(function RichTextEditor(
  { placeholder = 'Write a message…', minHeight = 160, maxHeight = 420, initialHtml = '', onChange },
  ref
) {
  const t = useTheme();
  const webRef = useRef<WebViewBridge>(null);
  const htmlRef = useRef(initialHtml);
  const flushSeq = useRef(0);
  const pendingFlushes = useRef(
    new Map<string, { resolve: (html: string) => void; timer: ReturnType<typeof setTimeout> }>()
  );
  const [height, setHeight] = useState(minHeight);
  const [focused, setFocused] = useState(false);
  // Built once: re-creating it would remount the WebView and lose the caret.
  const html = useMemo(() => buildDocument(initialHtml, placeholder), []);

  const run = useCallback((script: string) => {
    webRef.current?.injectJavaScript(`${script}; true;`);
  }, []);

  const flushHtml = useCallback(() => {
    return new Promise<string>((resolve) => {
      const requestId = String(++flushSeq.current);
      const timer = setTimeout(() => {
        pendingFlushes.current.delete(requestId);
        // Fall back to the last reported value rather than hanging the send.
        resolve(htmlRef.current);
      }, FLUSH_TIMEOUT_MS);
      pendingFlushes.current.set(requestId, { resolve, timer });
      run(`window.editorApi && window.editorApi.flush(${JSON.stringify(requestId)})`);
    });
  }, [run]);

  useImperativeHandle(
    ref,
    () => ({
      getHtml: () => htmlRef.current,
      flushHtml,
      setHtml: (next: string) => {
        htmlRef.current = next;
        run(`window.editorApi.setHtml(${JSON.stringify(next)})`);
      },
      appendHtml: (next: string) => {
        const existing = (htmlRef.current || '').trim();
        htmlRef.current =
          existing && existing !== '<br>' ? `${existing}<br/>${next}` : next;
        run(`window.editorApi.appendHtml(${JSON.stringify(next)})`);
      },
      focus: () => run('window.editorApi.focus()'),
      clear: () => {
        htmlRef.current = '';
        run(`window.editorApi.setHtml('')`);
      },
    }),
    [run, flushHtml]
  );

  const exec = (command: Command) => run(`window.editorApi.exec(${JSON.stringify(command)})`);

  const frameHeight = Math.min(Math.max(height, minHeight), maxHeight);

  return (
    <View style={[styles.wrap, { borderColor: focused ? t.primary : t.border }]}>
      <View style={[styles.toolbar, { backgroundColor: t.muted, borderBottomColor: t.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.toolbarRow}>
          {TOOLBAR.map((item) => (
            <Pressable
              key={item.command}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              onPress={() => exec(item.command)}
              style={({ pressed }) => [
                styles.toolButton,
                { backgroundColor: pressed ? t.accent : 'transparent' },
              ]}
            >
              <Ionicons name={item.icon} size={17} color={t.mutedForeground} />
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <BridgedWebView
        ref={webRef}
        originWhitelist={['*']}
        source={{ html }}
        onMessage={(event) => {
          try {
            const message = JSON.parse(event.nativeEvent.data) as {
              type: string;
              payload: string;
              requestId?: string | null;
            };
            if (message.type === 'html' || message.type === 'html-flush') {
              htmlRef.current = message.payload;
              onChange?.(message.payload);
              if (message.type === 'html-flush' && message.requestId) {
                const pending = pendingFlushes.current.get(message.requestId);
                if (pending) {
                  clearTimeout(pending.timer);
                  pendingFlushes.current.delete(message.requestId);
                  pending.resolve(message.payload);
                }
              }
            } else if (message.type === 'height') {
              const next = Number(message.payload);
              if (Number.isFinite(next) && next > 0) setHeight(next);
            } else if (message.type === 'focus') {
              setFocused(true);
            } else if (message.type === 'blur') {
              setFocused(false);
            }
          } catch {
            /* ignore malformed bridge messages */
          }
        }}
        onLoadEnd={() => {
          // Re-sync after load so the initial postMessage is never lost if RN
          // attached the listener after the first script ran.
          run('window.editorApi && window.editorApi.flush("load")');
        }}
        javaScriptEnabled
        keyboardDisplayRequiresUserAction={false}
        hideKeyboardAccessoryView
        scrollEnabled={height > maxHeight}
        style={{ height: frameHeight, backgroundColor: '#ffffff' }}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
  },
  toolbar: { borderBottomWidth: StyleSheet.hairlineWidth },
  toolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: spacing.xs,
    paddingVertical: 4,
  },
  toolButton: {
    width: 34,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
});
