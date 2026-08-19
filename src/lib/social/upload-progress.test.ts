import { describe, it, expect } from 'vitest';
import { createUploadTracker } from './upload-progress';

const MB = 1024 * 1024;

describe('createUploadTracker', () => {
  it('reports a rate and an ETA once a sample interval has passed', () => {
    const tracker = createUploadTracker(0);
    // 1 MB sent in 1s of a 10 MB file -> 9 MB left at 1 MB/s.
    const s = tracker.sample(1 * MB, 10 * MB, 1000);

    expect(s.speedBps).toBeCloseTo(1 * MB, 0);
    expect(s.etaSeconds).toBeCloseTo(9, 1);
    expect(s.progress).toBe(10);
  });

  it('ignores samples that arrive too close together', () => {
    const tracker = createUploadTracker(0);
    // 100ms is below the sampling interval, so no rate is established yet.
    const s = tracker.sample(1 * MB, 10 * MB, 100);

    expect(s.speedBps).toBeNull();
    expect(s.etaSeconds).toBeNull();
    // Progress itself still tracks every event.
    expect(s.progress).toBe(10);
  });

  it('smooths the rate instead of tracking every spike', () => {
    const tracker = createUploadTracker(0);
    tracker.sample(1 * MB, 100 * MB, 1000); // 1 MB/s
    // A burst 5x faster should pull the average up, not replace it outright.
    const s = tracker.sample(6 * MB, 100 * MB, 2000); // instantaneous 5 MB/s

    expect(s.speedBps! / MB).toBeCloseTo(0.6 * 1 + 0.4 * 5, 2);
    expect(s.speedBps! / MB).toBeLessThan(5);
    expect(s.speedBps! / MB).toBeGreaterThan(1);
  });

  it('keeps the last known rate when a stall reports no new bytes', () => {
    const tracker = createUploadTracker(0);
    const moving = tracker.sample(1 * MB, 10 * MB, 1000);
    const stalled = tracker.sample(1 * MB, 10 * MB, 2000);

    // A zero delta must not drag the average to zero and blow the ETA up to
    // Infinity — the label would jump from "9s left" to nothing and back.
    expect(stalled.speedBps).toBe(moving.speedBps);
    expect(Number.isFinite(stalled.etaSeconds!)).toBe(true);
  });

  it('holds at 99% while bytes are still in flight', () => {
    const tracker = createUploadTracker(0);
    // 99.6% rounds to 100, but the upload is not finished.
    const s = tracker.sample(99.6 * MB, 100 * MB, 1000);

    expect(s.progress).toBe(99);
    expect(s.isTransferComplete).toBe(false);
  });

  it('flags transfer completion once every byte is sent', () => {
    const tracker = createUploadTracker(0);
    const s = tracker.sample(10 * MB, 10 * MB, 1000);

    expect(s.progress).toBe(100);
    expect(s.isTransferComplete).toBe(true);
    expect(s.etaSeconds).toBe(0);
  });

  it('does not divide by zero on an empty file', () => {
    const tracker = createUploadTracker(0);
    const s = tracker.sample(0, 0, 1000);

    expect(s.progress).toBe(0);
    expect(s.isTransferComplete).toBe(false);
    expect(s.etaSeconds).toBeNull();
  });
});
