/**
 * Follows the operating system's light/dark preference.
 *
 * index.css has always defined a full `.dark` token set, but nothing ever put
 * that class on the document, so the app rendered light no matter what the OS
 * was set to. This applies it and keeps it in sync when the OS flips (macOS
 * auto-switching at sunset, for instance) without a reload.
 */

const DARK_QUERY = "(prefers-color-scheme: dark)";

export function applySystemTheme(isDark: boolean) {
  document.documentElement.classList.toggle("dark", isDark);
  // Tells the browser to render native widgets — scrollbars, form controls,
  // the address bar on mobile — in the matching scheme.
  document.documentElement.style.colorScheme = isDark ? "dark" : "light";
}

/**
 * Starts syncing and returns an unsubscribe function.
 * Safe to call in a non-browser environment, where it is a no-op.
 */
export function startSystemThemeSync(): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => {};
  }

  const media = window.matchMedia(DARK_QUERY);
  applySystemTheme(media.matches);

  const onChange = (event: MediaQueryListEvent) => applySystemTheme(event.matches);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}
