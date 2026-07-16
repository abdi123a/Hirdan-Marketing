type AuditEvent =
  | { action: 'auth.login'; success: boolean; userId?: string; email?: string; role?: string; ip?: string }
  | { action: 'auth.password_change'; success: boolean; userId: string; ip?: string }
  | { action: 'auth.forgot_password'; success: boolean; email?: string; ip?: string }
  | { action: 'auth.reset_password'; success: boolean; userId: string; email?: string; ip?: string }
  | { action: 'invoice.create'; success: boolean; userId: string; invoiceId?: string; clientId?: string; ip?: string }
  | { action: 'document.upload'; success: boolean; userId: string; clientId?: string; documentId?: string; ip?: string };

export function auditLog(event: AuditEvent) {
  // Minimal structured audit logging (ship this to your log pipeline in production)
  const payload = {
    ts: new Date().toISOString(),
    ...event,
  };
  // eslint-disable-next-line no-console
  console.log('[AUDIT]', JSON.stringify(payload));
}

