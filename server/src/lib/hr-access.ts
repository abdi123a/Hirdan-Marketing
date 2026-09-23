// ─────────────────────────────────────────────────────────────────────────────
// Who may see an employee's HR records (HR documents, ID documents, contracts…).
//
//   ADMIN   → any employee
//   MANAGER → their direct reports, manager-less employees when they are the
//             configured HR fallback approver, and their own record
//   STAFF   → their own record only
//   CLIENT  → never
//
// Used by hr.routes.ts, employee-files.routes.ts, files.routes.ts and
// verify.routes.ts so the rule is identical everywhere.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from './prisma.js';
import { AppError } from './errors.js';

export type HrAccessUser = { userId: string; role: string };

export type EmployeeRelation = {
  userId: string | null;
  managerId: string | null;
  manager?: { userId: string | null } | null;
};

/** Select clause that loads exactly what canAccessEmployee() needs. */
export const employeeAccessSelect = {
  userId: true,
  managerId: true,
  manager: { select: { userId: true } },
} as const;

export async function isHrFallbackApprover(userId: string): Promise<boolean> {
  const settings = await prisma.agencySettings.findFirst({ select: { hrFallbackApproverId: true } });
  return !!settings?.hrFallbackApproverId && settings.hrFallbackApproverId === userId;
}

export async function canAccessEmployee(user: HrAccessUser, employee: EmployeeRelation): Promise<boolean> {
  if (user.role === 'ADMIN') return true;
  if (user.role === 'CLIENT') return false;
  if (employee.userId && employee.userId === user.userId) return true;
  if (user.role !== 'MANAGER') return false;
  if (employee.manager?.userId && employee.manager.userId === user.userId) return true;
  if (!employee.managerId && (await isHrFallbackApprover(user.userId))) return true;
  return false;
}

export async function assertCanAccessEmployee(user: HrAccessUser, employeeId: string): Promise<void> {
  const employee = await prisma.teamMember.findUnique({
    where: { id: employeeId },
    select: employeeAccessSelect,
  });
  if (!employee) throw AppError.notFound('Employee not found');
  if (!(await canAccessEmployee(user, employee))) throw AppError.forbidden('Access denied');
}

/** Prisma `where` fragment (on a model with an `employee` relation) for a MANAGER's scope. */
export async function managerEmployeeScope(userId: string) {
  const or: Array<Record<string, unknown>> = [
    { employee: { manager: { userId } } },
    { employee: { userId } },
  ];
  if (await isHrFallbackApprover(userId)) or.push({ employee: { managerId: null } });
  return { OR: or };
}
