import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PublishProgressDialog, estimateRemainingSeconds, type PublishStatus, type PublishDestination } from './PublishProgressDialog';

function dest(overrides: Partial<PublishDestination> = {}): PublishDestination {
  return {
    id: 'd1',
    platform: 'INSTAGRAM',
    accountName: 'olympus_755',
    avatarUrl: 'https://example.test/logo.png',
    status: 'QUEUED',
    error: null,
    ...overrides,
  };
}

function status(overrides: Partial<PublishStatus> = {}): PublishStatus {
  return {
    postId: 'p1',
    status: 'publishing',
    totalDestinations: 2,
    completedDestinations: 0,
    failedDestinations: 0,
    destinations: [
      dest({ id: 'd1', status: 'PUBLISHING' }),
      dest({ id: 'd2', platform: 'FACEBOOK', accountName: 'Olympus Gym & Fitness', status: 'QUEUED' }),
    ],
    ...overrides,
  };
}

const noDrafts = () => false;

describe('estimateRemainingSeconds', () => {
  it('extrapolates from how long the finished destinations took', () => {
    // 1 of 4 done after 20s -> 20s each, 3 left.
    const s = status({ totalDestinations: 4, completedDestinations: 1 });
    expect(estimateRemainingSeconds(s, 20)).toBe(60);
  });

  it('returns null while nothing has finished, rather than inventing a number', () => {
    // The old code guessed 10s per destination and then printed "Few
    // seconds..." forever once the guess was blown.
    expect(estimateRemainingSeconds(status(), 32)).toBeNull();
  });

  it('counts failures as finished so a failing run still estimates', () => {
    const s = status({ totalDestinations: 4, failedDestinations: 2 });
    expect(estimateRemainingSeconds(s, 10)).toBe(10);
  });

  it('is zero once every destination is finished', () => {
    const s = status({ totalDestinations: 2, completedDestinations: 2 });
    expect(estimateRemainingSeconds(s, 47)).toBe(0);
  });

  it('handles an empty destination list without dividing by zero', () => {
    expect(estimateRemainingSeconds(status({ totalDestinations: 0, destinations: [] }), 5)).toBeNull();
  });
});

describe('PublishProgressDialog', () => {
  it('shows each account logo with its name', () => {
    render(<PublishProgressDialog open onClose={() => {}} status={status()} elapsedSeconds={32} isTikTokDraft={noDrafts} />);

    const logos = screen.getAllByRole('img', { name: 'olympus_755' });
    expect(logos.length).toBe(1);
    expect(logos[0].getAttribute('src')).toBe('https://example.test/logo.png');
    // Exactly once: the logo used to be drawn in a hero row and again in the
    // destination list, which read as a duplicate.
    expect(screen.getAllByText('olympus_755').length).toBe(1);
  });

  it('falls back to initials when an account has no logo', () => {
    const s = status({ destinations: [dest({ accountName: 'Olympus Gym', avatarUrl: null })] });
    render(<PublishProgressDialog open onClose={() => {}} status={s} elapsedSeconds={1} isTikTokDraft={noDrafts} />);

    expect(screen.getAllByText('OG').length).toBeGreaterThan(0);
  });

  it('reports progress and elapsed time without a fabricated estimate', () => {
    render(<PublishProgressDialog open onClose={() => {}} status={status()} elapsedSeconds={32} isTikTokDraft={noDrafts} />);

    // Radix portals dialog content to the body, so read the document, not the
    // render container. The count is split across elements for emphasis.
    expect(document.body.textContent).toContain('0 of 2 accounts done');
    expect(screen.getByText('32s')).toBeTruthy();
    // No estimate is shown at all until one destination has finished, rather
    // than a made-up "few seconds".
    expect(document.body.textContent).not.toContain('left');
  });

  it('shows a real estimate once a destination has finished', () => {
    const s = status({ completedDestinations: 1 });
    render(<PublishProgressDialog open onClose={() => {}} status={s} elapsedSeconds={30} isTikTokDraft={noDrafts} />);

    expect(document.body.textContent).toContain('1 of 2 accounts done');
    expect(screen.getByText('about 30s left')).toBeTruthy();
  });

  it('drops the time estimate once publishing is over', () => {
    const s = status({ status: 'success', completedDestinations: 2 });
    render(<PublishProgressDialog open onClose={() => {}} status={s} elapsedSeconds={47} isTikTokDraft={noDrafts} />);

    expect(screen.getByText('Post published')).toBeTruthy();
    expect(screen.getByText('Every account is live.')).toBeTruthy();
    expect(screen.queryByText(/left/)).toBeNull();
  });

  it('offers no close button while publishing, since publishing cannot be cancelled', () => {
    render(<PublishProgressDialog open onClose={() => {}} status={status()} elapsedSeconds={5} isTikTokDraft={noDrafts} />);
    expect(screen.queryByRole('button', { name: /close/i })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Done' })).toBeNull();
  });

  it('offers a working close button once the run has finished', () => {
    let closed = false;
    const s = status({ status: 'success', completedDestinations: 2 });
    render(<PublishProgressDialog open onClose={() => { closed = true; }} status={s} elapsedSeconds={47} isTikTokDraft={noDrafts} />);

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(closed).toBe(true);
  });

  it('surfaces per-destination status', () => {
    const s = status({
      status: 'failed',
      completedDestinations: 1,
      failedDestinations: 1,
      destinations: [
        dest({ id: 'd1', status: 'PUBLISHED' }),
        dest({ id: 'd2', platform: 'FACEBOOK', accountName: 'Olympus Gym', status: 'FAILED', error: 'Token expired' }),
      ],
    });
    render(<PublishProgressDialog open onClose={() => {}} status={s} elapsedSeconds={12} isTikTokDraft={noDrafts} />);

    expect(screen.getByText('Live')).toBeTruthy();
    expect(screen.getByText('Failed')).toBeTruthy();
    expect(screen.getByText('Some accounts did not go out. Hover a failure to see why.')).toBeTruthy();
  });

  it('labels a TikTok draft distinctly from a live post', () => {
    const s = status({
      status: 'success',
      totalDestinations: 1,
      completedDestinations: 1,
      destinations: [dest({ platform: 'TIKTOK', status: 'PUBLISHED' })],
    });
    render(<PublishProgressDialog open onClose={() => {}} status={s} elapsedSeconds={9} isTikTokDraft={() => true} />);

    expect(screen.getByText('In drafts')).toBeTruthy();
    expect(screen.getByText('Waiting for you in the TikTok app')).toBeTruthy();
  });
});
