import { describe, it, expect } from 'vitest';
import { xMediaMime, xMediaCategory, xMediaId, planXChunks, X_CHUNK_SIZE } from './x-media.js';

describe('planXChunks', () => {
  it('splits a file larger than the segment cap into multiple segments', () => {
    // The actual reported bug: anything over ~5MB went as one segment.
    const chunks = planXChunks(10 * 1024 * 1024);
    expect(chunks.length).toBe(3);
    expect(chunks.every(c => c.end - c.start <= X_CHUNK_SIZE)).toBe(true);
  });

  it('numbers segments consecutively from zero', () => {
    expect(planXChunks(10 * 1024 * 1024).map(c => c.index)).toEqual([0, 1, 2]);
  });

  it('covers the payload exactly, with no gaps or overlap', () => {
    const total = 9_999_999;
    const chunks = planXChunks(total);
    expect(chunks[0].start).toBe(0);
    expect(chunks[chunks.length - 1].end).toBe(total);
    for (let i = 1; i < chunks.length; i++) expect(chunks[i].start).toBe(chunks[i - 1].end);
    expect(chunks.reduce((n, c) => n + (c.end - c.start), 0)).toBe(total);
  });

  it('sends a small file as a single segment', () => {
    expect(planXChunks(1024)).toEqual([{ index: 0, start: 0, end: 1024 }]);
  });

  it('does not emit a trailing empty segment on an exact multiple', () => {
    const chunks = planXChunks(X_CHUNK_SIZE * 2);
    expect(chunks.length).toBe(2);
    expect(chunks.every(c => c.end > c.start)).toBe(true);
  });

  it('returns nothing for an empty payload', () => {
    expect(planXChunks(0)).toEqual([]);
  });
});

describe('xMediaMime', () => {
  it('maps video by extension, defaulting to mp4', () => {
    expect(xMediaMime('https://x/a.mp4', 'video')).toBe('video/mp4');
    expect(xMediaMime('https://x/a.mov', 'video')).toBe('video/quicktime');
    expect(xMediaMime('https://x/a', 'video')).toBe('video/mp4');
  });

  it('recovers gif from the filename even though mediaType is only ever image/video', () => {
    expect(xMediaMime('https://x/loop.gif', 'image')).toBe('image/gif');
  });

  it('handles png and webp, defaulting to jpeg', () => {
    expect(xMediaMime('https://x/a.png', 'image')).toBe('image/png');
    expect(xMediaMime('https://x/a.webp', 'image')).toBe('image/webp');
    expect(xMediaMime('https://x/a.jpg', 'image')).toBe('image/jpeg');
  });

  it('ignores query strings and fragments when reading the extension', () => {
    expect(xMediaMime('https://x/a.gif?v=2', 'image')).toBe('image/gif');
    expect(xMediaMime('https://x/a.png#frag', 'image')).toBe('image/png');
  });
});

describe('xMediaCategory', () => {
  it('maps mime to the category X expects at INIT', () => {
    expect(xMediaCategory('video/mp4')).toBe('tweet_video');
    expect(xMediaCategory('video/quicktime')).toBe('tweet_video');
    expect(xMediaCategory('image/gif')).toBe('tweet_gif');
    expect(xMediaCategory('image/jpeg')).toBe('tweet_image');
  });
});

describe('xMediaId', () => {
  it('reads the v2 shape', () => {
    expect(xMediaId({ data: { id: '123' } })).toBe('123');
  });

  it('tolerates the legacy media_id_string shapes', () => {
    expect(xMediaId({ data: { media_id_string: '456' } })).toBe('456');
    expect(xMediaId({ media_id_string: '789' })).toBe('789');
  });

  it('coerces a numeric id to string so precision is not lost downstream', () => {
    expect(xMediaId({ data: { id: 1234567890123456789 } })).toBe(String(1234567890123456789));
  });

  it('throws instead of returning undefined, which used to become media_ids:[null]', () => {
    expect(() => xMediaId({})).toThrow(/did not return a media id/);
    expect(() => xMediaId(null)).toThrow(/did not return a media id/);
  });
});
