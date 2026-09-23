import { describe, it, expect, vi } from 'vitest';

vi.mock('./prisma.js', () => ({ prisma: {} }));

const { isClientRequestAllowed, isPortalSectionEnabled } = await import('./permission-guard.js');

describe('isClientRequestAllowed', () => {
  it('allows reads', () => {
    expect(isClientRequestAllowed('GET', '/api/invoices')).toBe(true);
    expect(isClientRequestAllowed('HEAD', '/api/projects/1')).toBe(true);
    expect(isClientRequestAllowed('OPTIONS', '/api/proformas')).toBe(true);
  });

  it('allows only the self-service writes', () => {
    expect(isClientRequestAllowed('PUT', '/api/invoices/abc')).toBe(true);
    expect(isClientRequestAllowed('PUT', '/api/proformas/abc/')).toBe(true);
    expect(isClientRequestAllowed('PUT', '/api/clients/me')).toBe(true);
    expect(isClientRequestAllowed('put', '/API/Clients/ME')).toBe(true);
  });

  it('rejects every other mutation', () => {
    expect(isClientRequestAllowed('POST', '/api/invoices')).toBe(false);
    expect(isClientRequestAllowed('POST', '/api/invoices/abc/send-email')).toBe(false);
    expect(isClientRequestAllowed('DELETE', '/api/invoices/abc')).toBe(false);
    expect(isClientRequestAllowed('PUT', '/api/clients/abc')).toBe(false);
    expect(isClientRequestAllowed('PATCH', '/api/clients/me')).toBe(false);
    expect(isClientRequestAllowed('PUT', '/api/subscriptions/abc')).toBe(false);
    expect(isClientRequestAllowed('PUT', '/api/invoices/abc/items')).toBe(false);
    expect(isClientRequestAllowed('POST', '/api/projects')).toBe(false);
  });
});

describe('isPortalSectionEnabled', () => {
  it('defaults to enabled', () => {
    expect(isPortalSectionEnabled(null, 'invoices')).toBe(true);
    expect(isPortalSectionEnabled({}, 'projects')).toBe(true);
    expect(isPortalSectionEnabled('not json', 'invoices')).toBe(true);
  });

  it('honours explicit toggles', () => {
    expect(isPortalSectionEnabled({ financials: false }, 'invoices')).toBe(false);
    expect(isPortalSectionEnabled({ financials: false }, 'proforma')).toBe(false);
    expect(isPortalSectionEnabled('{"subscriptions":false}', 'subscriptions')).toBe(false);
    expect(isPortalSectionEnabled({ projects: false }, 'projects')).toBe(false);
    expect(isPortalSectionEnabled({ financials: false }, 'clients')).toBe(true);
  });
});
