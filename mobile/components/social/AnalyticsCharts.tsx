import React, { useMemo } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, G, Path, Rect, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../../hooks/useTheme';
import { fontSize, radius, spacing } from '../../constants/theme';
import { DAYS_SHORT, fmtN, PLATFORM_COLORS } from '../../lib/social-analytics';

function polar(cx: number, cy: number, r: number, angle: number) {
  const a = ((angle - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function arcPath(cx: number, cy: number, r: number, start: number, end: number) {
  const s = polar(cx, cy, r, end);
  const e = polar(cx, cy, r, start);
  const large = end - start <= 180 ? 0 : 1;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 0 ${e.x} ${e.y}`;
}

export function AreaLineChart({
  data,
  dataKey,
  height = 180,
  color,
}: {
  data: Array<Record<string, number | string>>;
  dataKey: string;
  height?: number;
  color?: string;
}) {
  const t = useTheme();
  const { width: screenW } = useWindowDimensions();
  const width = Math.max(280, screenW - spacing.lg * 4);
  const stroke = color || t.primary;
  const pad = { l: 36, r: 8, t: 12, b: 24 };

  const points = useMemo(() => {
    const vals = data.map((d) => Number(d[dataKey]) || 0);
    const max = Math.max(...vals, 1);
    const min = Math.min(...vals, 0);
    const span = Math.max(max - min, 1);
    const innerW = width - pad.l - pad.r;
    const innerH = height - pad.t - pad.b;
    return vals.map((v, i) => {
      const x = pad.l + (vals.length <= 1 ? innerW / 2 : (i / (vals.length - 1)) * innerW);
      const y = pad.t + innerH - ((v - min) / span) * innerH;
      return { x, y, v, label: String(data[i]?.date || data[i]?.week || '') };
    });
  }, [data, dataKey, width, height]);

  if (!data.length) {
    return <EmptyChart msg="Sync metrics to see data" />;
  }

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const area = `${line} L ${points[points.length - 1].x} ${height - pad.b} L ${points[0].x} ${height - pad.b} Z`;
  const maxV = Math.max(...points.map((p) => p.v), 1);

  return (
    <Svg width={width} height={height}>
      {[0, 0.5, 1].map((f) => {
        const y = pad.t + (height - pad.t - pad.b) * (1 - f);
        return (
          <G key={f}>
            <Path
              d={`M ${pad.l} ${y} L ${width - pad.r} ${y}`}
              stroke={t.border}
              strokeWidth={1}
              strokeDasharray="4 4"
            />
            <SvgText x={2} y={y + 3} fontSize={9} fill={t.mutedForeground}>
              {fmtN(maxV * f)}
            </SvgText>
          </G>
        );
      })}
      <Path d={area} fill={stroke} opacity={0.15} />
      <Path d={line} stroke={stroke} strokeWidth={2.5} fill="none" />
      {points.length <= 12
        ? points.map((p, i) =>
            i % Math.ceil(points.length / 6) === 0 || i === points.length - 1 ? (
              <SvgText
                key={i}
                x={p.x}
                y={height - 6}
                fontSize={9}
                fill={t.mutedForeground}
                textAnchor="middle"
              >
                {String(p.label).slice(5) || String(p.label).slice(0, 6)}
              </SvgText>
            ) : null
          )
        : null}
    </Svg>
  );
}

export function BarChartSimple({
  data,
  labelKey,
  valueKey,
  height = 160,
  color,
  horizontal,
}: {
  data: Array<Record<string, number | string>>;
  labelKey: string;
  valueKey: string;
  height?: number;
  color?: string;
  horizontal?: boolean;
}) {
  const t = useTheme();
  const { width: screenW } = useWindowDimensions();
  const width = Math.max(280, screenW - spacing.lg * 4);
  const fill = color || t.primary;
  const max = Math.max(...data.map((d) => Number(d[valueKey]) || 0), 1);

  if (!data.length) return <EmptyChart />;

  if (horizontal) {
    const rowH = 28;
    const h = Math.max(height, data.length * rowH + 8);
    const labelW = 72;
    const barMax = width - labelW - 48;
    return (
      <View style={{ gap: 6 }}>
        {data.map((d) => {
          const v = Number(d[valueKey]) || 0;
          const w = (v / max) * barMax;
          return (
            <View key={String(d[labelKey])} style={styles.hBarRow}>
              <Text style={[styles.hBarLabel, { color: t.mutedForeground }]} numberOfLines={1}>
                {String(d[labelKey])}
              </Text>
              <View style={[styles.hBarTrack, { backgroundColor: t.muted, width: barMax }]}>
                <View style={[styles.hBarFill, { width: w, backgroundColor: fill }]} />
              </View>
              <Text style={{ color: t.foreground, fontSize: 10, fontWeight: '700', width: 40 }}>
                {fmtN(v)}
              </Text>
            </View>
          );
        })}
        {h ? null : null}
      </View>
    );
  }

  const pad = { l: 8, r: 8, t: 8, b: 28 };
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const gap = 4;
  const barW = Math.max(6, (innerW - gap * (data.length - 1)) / data.length);

  return (
    <Svg width={width} height={height}>
      {data.map((d, i) => {
        const v = Number(d[valueKey]) || 0;
        const bh = (v / max) * innerH;
        const x = pad.l + i * (barW + gap);
        const y = pad.t + innerH - bh;
        return (
          <G key={i}>
            <Rect x={x} y={y} width={barW} height={bh} rx={3} fill={fill} />
            {data.length <= 10 ? (
              <SvgText
                x={x + barW / 2}
                y={height - 8}
                fontSize={8}
                fill={t.mutedForeground}
                textAnchor="middle"
              >
                {String(d[labelKey]).slice(0, 6)}
              </SvgText>
            ) : null}
          </G>
        );
      })}
    </Svg>
  );
}

export function DonutChart({
  segments,
  size = 140,
  centerLabel,
  centerValue,
}: {
  segments: Array<{ label: string; value: number; color: string }>;
  size?: number;
  centerLabel?: string;
  centerValue?: string;
}) {
  const t = useTheme();
  const total = segments.reduce((s, x) => s + (x.value || 0), 0) || 1;
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.36;
  let angle = 0;
  const arcs = segments.map((seg) => {
    const sweep = (seg.value / total) * 360;
    const start = angle;
    const end = angle + sweep;
    angle = end;
    return { ...seg, start, end };
  });

  return (
    <View style={{ alignItems: 'center', gap: spacing.sm }}>
      <Svg width={size} height={size}>
        <Circle cx={cx} cy={cy} r={r} stroke={t.muted} strokeWidth={14} fill="none" />
        {arcs.map((a) =>
          a.value > 0 ? (
            <Path
              key={a.label}
              d={arcPath(cx, cy, r, a.start, a.end)}
              stroke={a.color}
              strokeWidth={14}
              fill="none"
              strokeLinecap="butt"
            />
          ) : null
        )}
        {centerValue ? (
          <SvgText
            x={cx}
            y={cy - 2}
            fontSize={16}
            fontWeight="700"
            fill={t.foreground}
            textAnchor="middle"
          >
            {centerValue}
          </SvgText>
        ) : null}
        {centerLabel ? (
          <SvgText x={cx} y={cy + 14} fontSize={9} fill={t.mutedForeground} textAnchor="middle">
            {centerLabel}
          </SvgText>
        ) : null}
      </Svg>
      <View style={{ width: '100%', gap: 6 }}>
        {segments.map((s) => {
          const pct = total > 0 ? ((s.value / total) * 100).toFixed(1) : '0';
          return (
            <View key={s.label} style={styles.legendRow}>
              <View style={[styles.dot, { backgroundColor: s.color }]} />
              <Text style={{ color: t.foreground, flex: 1, fontSize: fontSize.sm, textTransform: 'capitalize' }}>
                {s.label}
              </Text>
              <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs }}>{fmtN(s.value)}</Text>
              <Text style={{ color: t.foreground, fontWeight: '700', fontSize: fontSize.xs, width: 42, textAlign: 'right' }}>
                {pct}%
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export function HeatmapGrid({
  cells,
  source,
}: {
  cells: Array<{ weekday: number; hour: number; value: number }>;
  source?: 'import' | 'posts';
}) {
  const t = useTheme();
  const max = Math.max(...cells.map((c) => c.value), 1);
  const map = new Map(cells.map((c) => [`${c.weekday}-${c.hour}`, c.value]));

  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs }}>
        {source === 'import'
          ? 'Based on imported follower activity'
          : 'Based on when your posts performed best'}
      </Text>
      <View style={styles.heatHeader}>
        <View style={{ width: 28 }} />
        {[0, 6, 12, 18, 23].map((h) => (
          <Text key={h} style={{ color: t.mutedForeground, fontSize: 9, width: 28, textAlign: 'center' }}>
            {h}h
          </Text>
        ))}
      </View>
      {DAYS_SHORT.map((day, weekday) => (
        <View key={day} style={styles.heatRow}>
          <Text style={{ color: t.mutedForeground, fontSize: 9, width: 28 }}>{day}</Text>
          <View style={styles.heatCells}>
            {Array.from({ length: 24 }, (_, hour) => {
              const v = map.get(`${weekday}-${hour}`) || 0;
              const opacity = v <= 0 ? 0.08 : 0.2 + (v / max) * 0.8;
              return (
                <View
                  key={hour}
                  style={[
                    styles.heatCell,
                    { backgroundColor: t.primary, opacity },
                  ]}
                />
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

export function EmptyChart({ msg = 'Sync metrics to see data' }: { msg?: string }) {
  const t = useTheme();
  return (
    <View style={styles.empty}>
      <Text style={{ color: t.mutedForeground, fontSize: fontSize.sm }}>{msg}</Text>
    </View>
  );
}

export function platformColor(platform?: string): string {
  if (!platform) return '#6B6578';
  return PLATFORM_COLORS[platform.toLowerCase()] || '#6B6578';
}

const styles = StyleSheet.create({
  empty: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  hBarRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hBarLabel: { width: 72, fontSize: 11, textTransform: 'capitalize' },
  hBarTrack: { height: 10, borderRadius: radius.full, overflow: 'hidden' },
  hBarFill: { height: 10, borderRadius: radius.full },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  heatHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingRight: 4 },
  heatRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  heatCells: { flex: 1, flexDirection: 'row', gap: 1 },
  heatCell: { flex: 1, height: 10, borderRadius: 2 },
});
