import { describe, it, expect } from 'vitest';
import { compactNumber, formatBytes, formatEta, formatDuration } from './format';

describe('compactNumber', () => {
  it('abbreviates millions and thousands to one decimal', () => {
    expect(compactNumber(1_200_000)).toBe('1.2M');
    expect(compactNumber(4_500)).toBe('4.5K');
  });

  it('renders values under a thousand with locale separators', () => {
    expect(compactNumber(812)).toBe('812');
    expect(compactNumber(0)).toBe('0');
  });

  it('renders a missing metric as an em dash, not zero', () => {
    // A metric the platform does not report is not the same as zero.
    expect(compactNumber(null)).toBe('—');
    expect(compactNumber(undefined)).toBe('—');
  });

  it('does not render NaN, which the un-nullsafe copy used to do', () => {
    expect(compactNumber(NaN)).toBe('—');
  });

  it('uses the boundary consistently', () => {
    expect(compactNumber(999)).toBe('999');
    expect(compactNumber(1_000)).toBe('1.0K');
    expect(compactNumber(999_999)).toBe('1000.0K');
    expect(compactNumber(1_000_000)).toBe('1.0M');
  });
});

describe('formatBytes', () => {
  it('scales through B / KB / MB / GB', () => {
    expect(formatBytes(900)).toBe('900 B');
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(50 * 1024 * 1024)).toBe('50 MB');
    expect(formatBytes(2.5 * 1024 * 1024 * 1024)).toBe('2.5 GB');
  });

  it('drops the decimal at 10 and above to keep the label short', () => {
    expect(formatBytes(9.4 * 1024 * 1024)).toBe('9.4 MB');
    expect(formatBytes(12.4 * 1024 * 1024)).toBe('12 MB');
  });

  it('renders unknown sizes as an em dash rather than NaN', () => {
    expect(formatBytes(null)).toBe('—');
    expect(formatBytes(undefined)).toBe('—');
    expect(formatBytes(NaN)).toBe('—');
    expect(formatBytes(-1)).toBe('—');
  });
});

describe('formatEta', () => {
  it('renders sub-minute estimates in whole seconds', () => {
    expect(formatEta(14)).toBe('14s left');
    expect(formatEta(14.2)).toBe('15s left');
    expect(formatEta(59)).toBe('59s left');
  });

  it('renders minutes with zero-padded seconds', () => {
    expect(formatEta(60)).toBe('1m 00s left');
    expect(formatEta(185)).toBe('3m 05s left');
  });

  it('never rolls seconds up to 60', () => {
    // 119.7s rounds to 120s, which must read as "2m 00s", not "1m 60s".
    expect(formatEta(119.7)).toBe('2m 00s left');
  });

  it('falls back to hours for very slow connections', () => {
    expect(formatEta(3600)).toBe('1h 00m left');
    expect(formatEta(7500)).toBe('2h 05m left');
  });

  it('returns an empty label when the estimate is unusable', () => {
    // A stalled transfer yields Infinity; showing nothing beats "Infinitys left".
    expect(formatEta(Infinity)).toBe('');
    expect(formatEta(null)).toBe('');
    expect(formatEta(undefined)).toBe('');
    expect(formatEta(-5)).toBe('');
  });

  it('says almost done rather than 0s left', () => {
    expect(formatEta(0)).toBe('almost done');
  });
});

describe('formatDuration', () => {
  it('renders bare seconds under a minute', () => {
    expect(formatDuration(0)).toBe('0s');
    expect(formatDuration(32)).toBe('32s');
  });

  it('switches to minutes with zero-padded seconds', () => {
    expect(formatDuration(90)).toBe('1m 30s');
    expect(formatDuration(605)).toBe('10m 05s');
  });

  it('never rolls seconds up to 60', () => {
    expect(formatDuration(119.7)).toBe('2m 00s');
  });

  it('falls back to hours for a very long publish', () => {
    expect(formatDuration(3660)).toBe('1h 01m');
  });

  it('renders an unknown duration as an em dash', () => {
    expect(formatDuration(null)).toBe('—');
    expect(formatDuration(Infinity)).toBe('—');
  });
});
