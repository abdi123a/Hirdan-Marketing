/**
 * Helpers for logging / surfacing social API errors without leaking tokens.
 * Axios dumps often include full request URLs with access_token=… — never log those raw.
 */

export function redactSecrets(input: unknown): string {
  let text: string;
  if (typeof input === 'string') {
    text = input;
  } else {
    try {
      text = JSON.stringify(input);
    } catch {
      text = String(input);
    }
  }

  return text
    .replace(/access_token=[^&\s"'\\]+/gi, 'access_token=REDACTED')
    .replace(/refresh_token=[^&\s"'\\]+/gi, 'refresh_token=REDACTED')
    .replace(/fb_exchange_token=[^&\s"'\\]+/gi, 'fb_exchange_token=REDACTED')
    .replace(/Bearer\s+[A-Za-z0-9._\-]+/gi, 'Bearer REDACTED')
    .replace(/\bEAA[A-Za-z0-9]+/g, 'REDACTED_META_TOKEN')
    .replace(/\bya29\.[A-Za-z0-9._\-]+/g, 'REDACTED_GOOGLE_TOKEN')
    .replace(/\b[0-9]+-[A-Za-z0-9_]+\.apps\.googleusercontent\.com/g, 'REDACTED_GOOGLE_CLIENT');
}

/** Safe, human-readable message from platform / Axios errors. */
export function extractSocialApiError(err: unknown): string {
  const anyErr = err as any;
  const msg =
    anyErr?.response?.data?.error?.message ||
    anyErr?.response?.data?.error_description ||
    anyErr?.response?.data?.error?.error_user_msg ||
    (typeof anyErr?.response?.data?.error === 'string' ? anyErr.response.data.error : null) ||
    anyErr?.response?.data?.message ||
    anyErr?.message ||
    'Unknown error';
  return redactSecrets(String(msg));
}

export function isAuthError(err: unknown): boolean {
  const anyErr = err as any;
  const status = anyErr?.response?.status;
  if (status === 401 || status === 403) return true;
  const msg = extractSocialApiError(err).toLowerCase();
  return (
    msg.includes('invalid authentication') ||
    msg.includes('invalid credentials') ||
    (msg.includes('token') && (msg.includes('expired') || msg.includes('invalid'))) ||
    msg.includes('oauth') ||
    msg.includes('session has expired') ||
    msg.includes('error validating access token') ||
    msg.includes('must be granted before impersonating')
  );
}

export function logSocialError(context: string, err: unknown): void {
  console.error(redactSecrets(`${context}: ${extractSocialApiError(err)}`));
}
