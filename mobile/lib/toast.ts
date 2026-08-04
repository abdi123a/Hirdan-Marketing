export type ToastTone = 'default' | 'success' | 'error';

type Handler = (message: string, tone?: ToastTone) => void;

let handler: Handler | null = null;

/** Registered by ToastProvider so non-component code can raise toasts. */
export function setToastHandler(fn: Handler | null) {
  handler = fn;
}

export const toast = {
  success: (message: string) => handler?.(message, 'success'),
  error: (message: string) => handler?.(message, 'error'),
  info: (message: string) => handler?.(message, 'default'),
};
