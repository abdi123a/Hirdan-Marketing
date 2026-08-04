/** Matches the Sheet slide animation, so the dismissal finishes before the handoff. */
const SHEET_ANIMATION_MS = 320;

/**
 * Opens a second sheet/modal after the current one has finished dismissing.
 * iOS cannot present a native modal while another is still animating away, so
 * the two must be sequenced rather than toggled in the same tick.
 */
export function afterSheetClose(open: () => void): void {
  setTimeout(open, SHEET_ANIMATION_MS);
}
