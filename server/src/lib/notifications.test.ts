import { describe, it, expect, vi } from 'vitest';

vi.mock('./prisma.js', () => ({ prisma: {} }));

const { broadcastModules, canReceiveBroadcast } = await import('./notifications.js');
const { resolvePermissions } = await import('./permissions.js');

describe('broadcast push recipients', () => {
  const noInvoices = resolvePermissions('STAFF', { invoices: 'NONE', hr: 'NONE' });
  const withInvoices = resolvePermissions('STAFF', { invoices: 'READ', hr: 'READ' });

  it('maps entity types and HR_ types to modules', () => {
    expect(broadcastModules({ type: 'INVOICE_PAID', entityType: 'INVOICE' })).toEqual(['invoices']);
    expect(broadcastModules({ type: 'HR_DOC', entityType: 'EMPLOYEE' })).toEqual(['team', 'hr']);
    expect(broadcastModules({ type: 'SYSTEM', entityType: null })).toEqual([]);
  });

  it('skips staff without READ on the module', () => {
    expect(canReceiveBroadcast(noInvoices, { type: 'INVOICE_PAID', entityType: 'INVOICE' })).toBe(false);
    expect(canReceiveBroadcast(withInvoices, { type: 'INVOICE_PAID', entityType: 'INVOICE' })).toBe(true);
    expect(canReceiveBroadcast(noInvoices, { type: 'HR_LEAVE', entityType: null })).toBe(false);
  });

  it('sends module-less broadcasts to every staff member', () => {
    expect(canReceiveBroadcast(noInvoices, { type: 'SYSTEM' })).toBe(true);
  });

  it('admins receive everything', () => {
    const admin = resolvePermissions('ADMIN', null);
    expect(canReceiveBroadcast(admin, { type: 'HR_LEAVE', entityType: 'INVOICE' })).toBe(true);
  });
});
