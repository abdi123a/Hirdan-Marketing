/**
 * `expo-clipboard` calls `requireNativeModule('ExpoClipboard')` at import time, which throws
 * when the installed native build predates the dependency. Importing it from a route file turns
 * that throw into an unloadable route, so it is resolved lazily on first use instead.
 */
export async function copyToClipboard(value: string): Promise<boolean> {
  try {
    const Clipboard = await import('expo-clipboard');
    await Clipboard.setStringAsync(value);
    return true;
  } catch {
    return false;
  }
}
