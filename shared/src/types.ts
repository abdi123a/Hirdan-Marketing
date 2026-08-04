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
  name: string;
  company: string;
  /** @deprecated Prefer `name` — kept for older payloads */
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  industry?: string | null;
  notes?: string | null;
  type?: string | null;
  status: string;
  initials?: string | null;
  logoUrl?: string | null;
  revenue?: number | null;
  invoiceGenerationDay?: number | null;
  paymentReminderDelay?: number | null;
  overdueNoticeDelay?: number | null;
  portalAccess?: Record<string, unknown> | null;
  /** Linked portal user id when client login is provisioned */
  userId?: string | null;
  _count?: {
    projects?: number;
    invoices?: number;
    subscriptions?: number;
    socialAccounts?: number;
  };
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
  /** Original file name (API: fileName). */
  fileName: string;
  /** Byte size (API: fileSize). */
  fileSize: number;
  client?: { id: string; name: string; email?: string | null } | null;
  expiresAt: string;
  createdAt: string;
  downloadCount: number;
  viewCount: number;
  isExpired: boolean;
  isDeleted: boolean;
  emailSentTo?: string | null;
  emailSentAt?: string | null;
  message?: string | null;
}

export interface TransferUploadResult {
  id: string;
  shareId: string;
  shareUrl: string;
  fileName: string;
  fileCount: number;
  expiresAt: string;
}

export interface TransferEvent {
  id: string;
  fileId: string;
  eventType: 'VIEW' | 'DOWNLOAD' | string;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
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
