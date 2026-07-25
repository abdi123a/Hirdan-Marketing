import { describe, it, expect } from 'vitest';
import { derivePermalink, tiktokVideoIdOf, isTikTokPublishId, videoIdFromLink } from './permalink.js';

describe('derivePermalink', () => {
  it('builds a YouTube watch URL from the upload id', () => {
    expect(derivePermalink('youtube', 'dQw4w9WgXcQ'))
      .toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  });

  it('builds an X status URL, but only with a handle', () => {
    expect(derivePermalink('x', '1234567890', { platformUsername: 'hirdan' }))
      .toBe('https://x.com/hirdan/status/1234567890');
    expect(derivePermalink('x', '1234567890')).toBeNull();
  });

  it('strips a leading @ from the stored handle', () => {
    expect(derivePermalink('x', '99', { platformUsername: '@hirdan' }))
      .toBe('https://x.com/hirdan/status/99');
  });

  it('builds a LinkedIn URL only from a URN', () => {
    expect(derivePermalink('linkedin', 'urn:li:share:7123'))
      .toBe('https://www.linkedin.com/feed/update/urn%3Ali%3Ashare%3A7123/');
    expect(derivePermalink('linkedin', '7123')).toBeNull();
  });

  it('splits a Facebook composite id into page and post', () => {
    expect(derivePermalink('facebook', '5550001_9998887'))
      .toBe('https://www.facebook.com/5550001/posts/9998887');
  });

  it('falls back to the account page id for a bare Facebook post id', () => {
    expect(derivePermalink('facebook', '9998887', { pageId: '5550001' }))
      .toBe('https://www.facebook.com/5550001/posts/9998887');
  });

  it('builds a TikTok video URL from a numeric video id', () => {
    expect(derivePermalink('tiktok', '7301234567890123456', { platformUsername: 'hirdan' }))
      .toBe('https://www.tiktok.com/@hirdan/video/7301234567890123456');
  });

  it('refuses to build a TikTok URL from a publish_id', () => {
    // A publish_id is a job handle, not a video id — guessing a URL from it
    // would produce a 404 link that looks legitimate.
    expect(derivePermalink('tiktok', 'v_pub_url~v2.123456', { platformUsername: 'hirdan' })).toBeNull();
    expect(derivePermalink('tiktok', 'v_inbox_url~v2.99', { platformUsername: 'hirdan' })).toBeNull();
  });

  it('returns null for platforms whose public URL needs an API lookup', () => {
    expect(derivePermalink('instagram', '17895695668004550')).toBeNull();
    expect(derivePermalink('threads', '17895695668004550')).toBeNull();
  });

  it('returns null for missing or blank ids', () => {
    expect(derivePermalink('youtube', null)).toBeNull();
    expect(derivePermalink('youtube', '   ')).toBeNull();
  });
});

describe('isTikTokPublishId', () => {
  it('recognises publish and inbox job handles', () => {
    expect(isTikTokPublishId('v_pub_url~v2.123')).toBe(true);
    expect(isTikTokPublishId('v_inbox_url~v2.123')).toBe(true);
    expect(isTikTokPublishId('7301234567890123456')).toBe(false);
  });
});

describe('videoIdFromLink', () => {
  it('extracts the numeric id from a TikTok video URL', () => {
    expect(videoIdFromLink('https://www.tiktok.com/@hirdan/video/7301234567890123456'))
      .toBe('7301234567890123456');
  });

  it('extracts the id from photo (slideshow) and legacy share links', () => {
    // These appear in real Studio content exports; the old /video/-only pattern
    // missed them and the importer dropped the row entirely.
    expect(videoIdFromLink('https://www.tiktok.com/@hirdan/photo/7301234567890123456'))
      .toBe('7301234567890123456');
    expect(videoIdFromLink('https://m.tiktok.com/v/7301234567890123456.html'))
      .toBe('7301234567890123456');
  });

  it('accepts a cell holding just the id', () => {
    expect(videoIdFromLink('7301234567890123456')).toBe('7301234567890123456');
    expect(videoIdFromLink(' 7301234567890123456 ')).toBe('7301234567890123456');
  });

  it('returns null for anything that is not a video link', () => {
    expect(videoIdFromLink('https://www.tiktok.com/@hirdan')).toBeNull();
    expect(videoIdFromLink(null)).toBeNull();
    // Short links carry no id — the importer must key these some other way
    // rather than treating them as unimportable.
    expect(videoIdFromLink('https://vt.tiktok.com/ZSAbCdEf/')).toBeNull();
    // A stray small number is not a snowflake id.
    expect(videoIdFromLink('2024')).toBeNull();
  });
});

describe('tiktokVideoIdOf', () => {
  it('prefers the id embedded in the stored public URL', () => {
    expect(tiktokVideoIdOf({
      platform: 'tiktok',
      platformPostId: 'v_pub_url~v2.123',
      platformPostUrl: 'https://www.tiktok.com/@hirdan/video/7301234567890123456',
    })).toBe('7301234567890123456');
  });

  it('falls back to a numeric platformPostId', () => {
    expect(tiktokVideoIdOf({ platform: 'tiktok', platformPostId: '7301234567890123456' }))
      .toBe('7301234567890123456');
  });

  it('never returns a publish_id as a video id', () => {
    expect(tiktokVideoIdOf({ platform: 'tiktok', platformPostId: 'v_pub_url~v2.123' })).toBeNull();
  });

  it('ignores non-TikTok destinations', () => {
    expect(tiktokVideoIdOf({ platform: 'instagram', platformPostId: '7301234567890123456' })).toBeNull();
  });
});
