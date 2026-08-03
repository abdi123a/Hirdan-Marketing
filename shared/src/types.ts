/**
 * Shared API response / entity types used by web and mobile clients.
 * Keep in sync with Prisma models in server/prisma/schema.prisma.
 */

import type { AccessLevel, ModuleKey, PermissionMap } from './permissions';

export type UserRole = 'ADMIN' | 'MANAGER' | 'STAFF' | 'CLIENT';
export type UserRoleLower = 'admin' | 'manager' | 'staff' | 'client';

export interface AuthUserDto {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  permissions?: PermissionMap | null;
  resolvedPermissions?: Record<ModuleKey, AccessLevel> | null;
  requiresPasswordChange?: boolean;
  mustChangePassword?: boolean;
  clientId?: string;
  company?: string;
}

export interface LoginResponse {
  accessToken: string;
  /** Present only for mobile clients (X-Client-Platform: mobile) */
  refreshToken?: string;
  user: AuthUserDto;
  message?: string;
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken?: string;
}

export interface ClientSummary {
  id: string;
  company: string;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  status: string;
  industry?: string | null;
  logoUrl?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface InvoiceSummary {
  id: string;
  invoiceNumber: string;
  clientId: string;
  client?: { id: string; company: string };
  status: string;
  total: number;
  currency?: string;
  issueDate: string;
  dueDate?: string | null;
  paidAt?: string | null;
}

export interface ProformaSummary {
  id: string;
  proformaNumber: string;
  clientId: string;
  client?: { id: string; company: string };
  status: string;
  total: number;
  currency?: string;
  issueDate: string;
  validUntil?: string | null;
}

export interface ExpenseSummary {
  id: string;
  description: string;
  amount: number;
  currency?: string;
  category?: string | null;
  date: string;
  receiptUrl?: string | null;
  status?: string;
}

export interface NotificationDto {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  actionUrl?: string | null;
  createdAt: string;
}

export interface NotificationCounts {
  total: number;
  unread: number;
}

export interface TeamMemberSummary {
  id: string;
  name: string;
  email?: string | null;
  role?: string | null;
  department?: string | null;
  photoUrl?: string | null;
  status?: string;
}

export interface HrDocumentSummary {
  id: string;
  title: string;
  type: string;
  employeeId?: string | null;
  status?: string;
  createdAt: string;
}

export interface TransferSummary {
  id: string;
  shareId: string;
  filename: string;
  size: number;
  expiresAt?: string | null;
  createdAt: string;
  downloadCount?: number;
}

export interface SocialAccountSummary {
  id: string;
  platform: string;
  accountName: string;
  username?: string | null;
  avatarUrl?: string | null;
  clientId?: string | null;
  status?: string;
}

export interface CalendarEventSummary {
  id: string;
  title: string;
  start: string;
  end?: string | null;
  type?: string;
  clientId?: string | null;
}

export interface DeviceRegistration {
  token: string;
  platform: 'ios' | 'android' | 'web';
  deviceName?: string;
}
