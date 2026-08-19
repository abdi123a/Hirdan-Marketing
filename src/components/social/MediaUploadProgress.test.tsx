import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UploadProgressTile, UploadProgressDetails } from './MediaUploadProgress';
import { type UploadProgressFile } from '@/lib/social/types';

const MB = 1024 * 1024;

function uploadingFile(overrides: Partial<UploadProgressFile> = {}): UploadProgressFile {
  return {
    id: 'u1',
    name: 'promo-reel.mp4',
    progress: 42,
    status: 'uploading',
    type: 'video',
    loadedBytes: 62 * MB,
    totalBytes: 148 * MB,
    speedBps: 3 * MB,
    etaSeconds: 64,
    ...overrides,
  };
}

describe('UploadProgressTile', () => {
  it('shows the percentage and time remaining instead of a bare spinner', () => {
    render(<UploadProgressTile file={uploadingFile()} />);

    expect(screen.getByText('42%')).toBeTruthy();
    expect(screen.getByText('1m 04s left')).toBeTruthy();
  });

  it('exposes progress to assistive tech', () => {
    render(<UploadProgressTile file={uploadingFile()} />);
    const bar = screen.getByRole('progressbar');

    expect(bar.getAttribute('aria-valuenow')).toBe('42');
    expect(bar.getAttribute('aria-label')).toBe('Uploading promo-reel.mp4');
  });

  it('says "Starting…" rather than showing an empty label before the first rate sample', () => {
    render(<UploadProgressTile file={uploadingFile({ progress: 0, etaSeconds: null, speedBps: null })} />);

    expect(screen.getByText('0%')).toBeTruthy();
    expect(screen.getByText('Starting…')).toBeTruthy();
  });

  it('reads as processing, not frozen, once the bytes are all sent', () => {
    render(<UploadProgressTile file={uploadingFile({ status: 'processing', progress: 100, etaSeconds: null })} />);

    expect(screen.getByText('100%')).toBeTruthy();
    expect(screen.getByText('Processing…')).toBeTruthy();
  });
});

describe('UploadProgressDetails', () => {
  it('lists the file, bytes transferred, rate and time remaining', () => {
    render(<UploadProgressDetails files={[uploadingFile()]} />);

    expect(screen.getByText('promo-reel.mp4')).toBeTruthy();
    expect(screen.getByText('62 MB of 148 MB')).toBeTruthy();
    expect(screen.getByText('· 3.0 MB/s')).toBeTruthy();
    expect(screen.getByText('· 1m 04s left')).toBeTruthy();
  });

  it('omits the rate and ETA until they are known', () => {
    render(<UploadProgressDetails files={[uploadingFile({ speedBps: null, etaSeconds: null })]} />);

    expect(screen.queryByText(/MB\/s/)).toBeNull();
    expect(screen.queryByText(/left/)).toBeNull();
    // The byte counts still render, so the row is never empty.
    expect(screen.getByText('62 MB of 148 MB')).toBeTruthy();
  });

  it('explains the wait during server-side processing', () => {
    render(<UploadProgressDetails files={[uploadingFile({ status: 'processing', progress: 100 })]} />);

    expect(screen.getByText('Uploaded 148 MB · finishing on the server…')).toBeTruthy();
  });

  it('renders one row per concurrent upload', () => {
    render(<UploadProgressDetails files={[uploadingFile(), uploadingFile({ id: 'u2', name: 'teaser.mp4' })]} />);

    expect(screen.getByText('promo-reel.mp4')).toBeTruthy();
    expect(screen.getByText('teaser.mp4')).toBeTruthy();
  });

  it('renders nothing when no upload is in flight', () => {
    const { container } = render(<UploadProgressDetails files={[]} />);
    expect(container.innerHTML).toBe('');
  });
});
