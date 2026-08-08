import React, { useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { fontSize, radius, spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';

const HEIGHT_CAP = 520;

/**
 * Wrap the email's own HTML with a viewport and defensive responsive styles so
 * it renders isolated inside the WebView: its media queries respond to the
 * phone width, images and tables are capped, and its CSS can't leak out.
 */
function buildDocument(html: string): string {
  const head =
    `<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<base target="_blank">` +
    `<style>` +
    `html,body{margin:0;padding:0;background:#ffffff;}` +
    `body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;` +
    `font-size:15px;line-height:1.6;color:#1f2937;word-wrap:break-word;overflow-wrap:anywhere;-webkit-text-size-adjust:100%;}` +
    `img{max-width:100%!important;height:auto;}` +
    `table{max-width:100%!important;}` +
    `a{color:#2563eb;}` +
    `*{box-sizing:border-box;}` +
    `</style>`;

  if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, `${head}</head>`);
  if (/<html[\s>]/i.test(html)) return html.replace(/<html([^>]*)>/i, `<html$1><head>${head}</head>`);
  return `<!doctype html><html><head>${head}</head><body>${html}</body></html>`;
}

const MEASURE_SCRIPT = `
(function () {
  function post() {
    var h = Math.max(
      document.documentElement.scrollHeight,
      document.body ? document.body.scrollHeight : 0
    );
    window.ReactNativeWebView.postMessage(String(h + 4));
  }
  post();
  window.addEventListener('load', post);
  setTimeout(post, 250);
  setTimeout(post, 800);
  var imgs = document.querySelectorAll('img');
  for (var i = 0; i < imgs.length; i++) {
    if (!imgs[i].complete) imgs[i].addEventListener('load', post);
  }
  if (window.ResizeObserver && document.body) {
    new ResizeObserver(post).observe(document.body);
  }
  true;
})();
`;

function ShowMoreButton({ expanded, onPress }: { expanded: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.showMore, { backgroundColor: t.muted, borderColor: t.border }]}
    >
      <Ionicons
        name={expanded ? 'chevron-up' : 'chevron-down'}
        size={14}
        color={t.mutedForeground}
      />
      <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs, fontWeight: '600' }}>
        {expanded ? 'Show less' : 'Show full message'}
      </Text>
    </Pressable>
  );
}

export function EmailBody({ html, text }: { html?: string | null; text?: string | null }) {
  const t = useTheme();
  const [height, setHeight] = useState(200);
  const [expanded, setExpanded] = useState(false);
  const document = useMemo(() => (html ? buildDocument(html) : ''), [html]);

  if (html) {
    const tall = height > HEIGHT_CAP + 60;
    const shown = tall && !expanded ? HEIGHT_CAP : height;
    return (
      <View style={{ width: '100%' }}>
        <View style={[styles.frame, { height: shown, borderColor: t.border }]}>
          <WebView
            originWhitelist={['*']}
            source={{ html: document }}
            injectedJavaScript={MEASURE_SCRIPT}
            onMessage={(event) => {
              const next = Number(event.nativeEvent.data);
              if (Number.isFinite(next) && next > 0) setHeight(next);
            }}
            // Keep the reader inside the app: taps on links go to the browser.
            onShouldStartLoadWithRequest={(request) => {
              if (request.url === 'about:blank' || request.url.startsWith('data:')) return true;
              Linking.openURL(request.url).catch(() => undefined);
              return false;
            }}
            scrollEnabled={false}
            nestedScrollEnabled={false}
            javaScriptEnabled
            setSupportMultipleWindows={false}
            style={{ height: shown, backgroundColor: '#ffffff' }}
          />
        </View>
        {tall ? <ShowMoreButton expanded={expanded} onPress={() => setExpanded((v) => !v)} /> : null}
      </View>
    );
  }

  const longText = (text?.length ?? 0) > 1200;
  return (
    <View style={{ width: '100%' }}>
      <Text
        style={{ color: t.foreground, fontSize: fontSize.sm, lineHeight: 21 }}
        numberOfLines={longText && !expanded ? 18 : undefined}
      >
        {text || ''}
      </Text>
      {longText ? <ShowMoreButton expanded={expanded} onPress={() => setExpanded((v) => !v)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    overflow: 'hidden',
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: '#ffffff',
  },
  showMore: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
});
