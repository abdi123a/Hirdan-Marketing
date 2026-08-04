import React, { useMemo } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { G, Path, Rect, Text as SvgText } from 'react-native-svg';
import { fontSize, radius, spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';

export const SENT_COLOR = '#6366f1';
export const RECEIVED_COLOR = '#10b981';

function niceMax(value: number): number {
  if (value <= 4) return 4;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  return Math.ceil(value / magnitude) * magnitude;
}

/** Two-series area chart (sent vs received), mirroring the web volume chart. */
export function VolumeChart({
  data,
  height = 220,
}: {
  data: { date: string; sent: number; received: number }[];
  height?: number;
}) {
  const t = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const width = Math.max(260, screenWidth - spacing.md * 2 - spacing.md * 2 - 2);
  const pad = { left: 30, right: 8, top: 10, bottom: 22 };

  const geometry = useMemo(() => {
    const max = niceMax(Math.max(...data.flatMap((d) => [d.sent, d.received]), 1));
    const innerWidth = width - pad.left - pad.right;
    const innerHeight = height - pad.top - pad.bottom;
    const x = (index: number) =>
      pad.left + (data.length <= 1 ? innerWidth / 2 : (index / (data.length - 1)) * innerWidth);
    const y = (value: number) => pad.top + innerHeight - (value / max) * innerHeight;

    const build = (key: 'sent' | 'received') => {
      const line = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(d[key])}`).join(' ');
      const baseline = pad.top + innerHeight;
      const area = `${line} L ${x(data.length - 1)} ${baseline} L ${x(0)} ${baseline} Z`;
      return { line, area };
    };

    return { max, x, y, sent: build('sent'), received: build('received'), innerHeight };
  }, [data, width, height]);

  if (data.length === 0) return <ChartEmpty message="No volume yet" />;

  return (
    <View style={{ gap: spacing.sm }}>
      <Svg width={width} height={height}>
        {[0, 0.5, 1].map((fraction) => {
          const y = pad.top + geometry.innerHeight * (1 - fraction);
          return (
            <G key={fraction}>
              <Path
                d={`M ${pad.left} ${y} L ${width - pad.right} ${y}`}
                stroke={t.border}
                strokeWidth={1}
                strokeDasharray="4 4"
              />
              <SvgText x={2} y={y + 3} fontSize={9} fill={t.mutedForeground}>
                {String(Math.round(geometry.max * fraction))}
              </SvgText>
            </G>
          );
        })}

        <Path d={geometry.received.area} fill={RECEIVED_COLOR} opacity={0.16} />
        <Path d={geometry.received.line} stroke={RECEIVED_COLOR} strokeWidth={2} fill="none" />
        <Path d={geometry.sent.area} fill={SENT_COLOR} opacity={0.16} />
        <Path d={geometry.sent.line} stroke={SENT_COLOR} strokeWidth={2} fill="none" />

        {data.map((point, index) =>
          index % Math.ceil(data.length / 5) === 0 || index === data.length - 1 ? (
            <SvgText
              key={point.date}
              x={geometry.x(index)}
              y={height - 6}
              fontSize={9}
              fill={t.mutedForeground}
              textAnchor="middle"
            >
              {point.date.slice(5)}
            </SvgText>
          ) : null
        )}
      </Svg>
      <ChartLegend />
    </View>
  );
}

/** Grouped bars for sent vs received per category. */
export function GroupedBars({
  data,
  height = 200,
}: {
  data: { label: string; sent: number; received: number }[];
  height?: number;
}) {
  const t = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const width = Math.max(260, screenWidth - spacing.md * 2 - spacing.md * 2 - 2);

  if (data.length === 0) return <ChartEmpty />;

  const pad = { left: 30, right: 8, top: 10, bottom: 26 };
  const innerWidth = width - pad.left - pad.right;
  const innerHeight = height - pad.top - pad.bottom;
  const max = niceMax(Math.max(...data.flatMap((d) => [d.sent, d.received]), 1));
  const groupWidth = innerWidth / data.length;
  const barWidth = Math.max(5, Math.min(18, (groupWidth - 8) / 2));

  return (
    <View style={{ gap: spacing.sm }}>
      <Svg width={width} height={height}>
        {[0, 0.5, 1].map((fraction) => {
          const y = pad.top + innerHeight * (1 - fraction);
          return (
            <G key={fraction}>
              <Path
                d={`M ${pad.left} ${y} L ${width - pad.right} ${y}`}
                stroke={t.border}
                strokeWidth={1}
                strokeDasharray="4 4"
              />
              <SvgText x={2} y={y + 3} fontSize={9} fill={t.mutedForeground}>
                {String(Math.round(max * fraction))}
              </SvgText>
            </G>
          );
        })}

        {data.map((item, index) => {
          const center = pad.left + groupWidth * index + groupWidth / 2;
          const receivedHeight = (item.received / max) * innerHeight;
          const sentHeight = (item.sent / max) * innerHeight;
          const baseline = pad.top + innerHeight;
          return (
            <G key={item.label}>
              <Rect
                x={center - barWidth - 1}
                y={baseline - receivedHeight}
                width={barWidth}
                height={receivedHeight}
                rx={2}
                fill={RECEIVED_COLOR}
              />
              <Rect
                x={center + 1}
                y={baseline - sentHeight}
                width={barWidth}
                height={sentHeight}
                rx={2}
                fill={SENT_COLOR}
              />
              <SvgText
                x={center}
                y={height - 8}
                fontSize={9}
                fill={t.mutedForeground}
                textAnchor="middle"
              >
                {item.label.length > 9 ? `${item.label.slice(0, 8)}…` : item.label}
              </SvgText>
            </G>
          );
        })}
      </Svg>
      <ChartLegend />
    </View>
  );
}

function ChartLegend() {
  const t = useTheme();
  return (
    <View style={styles.legend}>
      <View style={styles.legendItem}>
        <View style={[styles.legendDot, { backgroundColor: RECEIVED_COLOR }]} />
        <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs }}>Received</Text>
      </View>
      <View style={styles.legendItem}>
        <View style={[styles.legendDot, { backgroundColor: SENT_COLOR }]} />
        <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs }}>Sent</Text>
      </View>
    </View>
  );
}

export function ChartEmpty({ message = 'No data' }: { message?: string }) {
  const t = useTheme();
  return (
    <View style={styles.empty}>
      <Text style={{ color: t.mutedForeground, fontSize: fontSize.sm }}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  legend: { flexDirection: 'row', gap: spacing.lg },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 9, height: 9, borderRadius: radius.full },
  empty: { minHeight: 110, alignItems: 'center', justifyContent: 'center' },
});
