/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiFetch, apiUpload } from './api-client';
import { formatCurrency, normalizeFeatureList } from './utils';

// Secure token generation using crypto API
function generateSecureToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

export interface Client {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  type: 'Business' | 'Individual';
  website?: string;
  address?: string;
  city?: string;
  country?: string;
  industry?: string;
  notes?: string;
  status: 'Active' | 'Paused' | 'Churned';
  projects: number;
  revenue: string;
  initials: string;
  createdAt: string;
  userId?: string | null;
  invoiceGenerationDay?: number | null;
  paymentReminderDelay?: number | null;
  overdueNoticeDelay?: number | null;
  portalAccess?: Record<string, boolean> | null;
}

export interface Project {
  id: string;
  name: string;
  client: string;
  description?: string;
  status: 'In Progress' | 'Completed' | 'On Hold' | 'Archived';
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  progress: number;
  budget?: string;
  startDate?: string;
  dueDate: string;
  team: string[];
  tags?: string[];
  createdAt: string;
}

export interface TeamMember {
  id: string;
  userId?: string | null;
  name: string;
  email: string;
  phone?: string;
  role: string;
  department?: string;
  status: 'Draft' | 'Pending Documents' | 'Active' | 'On Leave' | 'Terminated';
  avatar?: string;
  photoUrl?: string;
  projects: number;
  hourlyRate?: string;
  startDate?: string;
  bio?: string;
  createdAt: string;
  archivedAt?: string;

  // Personal Info (Step 1)
  dateOfBirth?: string;
  gender?: string;
  nationalId?: string;
  nationalIdType?: string;
  nationality?: string;
  homeAddress?: string;
  emergencyContactName?: string;
  emergencyContactRelation?: string;
  emergencyContactPhone?: string;

  // Employment Info (Step 2)
  employmentType?: string;
  managerId?: string;
  workLocation?: string;

  // Payroll Info (Step 4)
  isHourlyMode?: boolean;
  basicSalary?: string;
  housingAllowance?: string;
  transportAllowance?: string;
  otherAllowances?: string;
  bankName?: string;
  accountNumber?: string;
  taxId?: string;
  paymentMethod?: string;
  currency?: string;
}

export interface EmployeeFile {
  id: string;
  employeeId: string;
  category: 'ID_DOC' | 'CONTRACT' | 'CV' | 'CERTIFICATE' | 'OTHER';
  label: string;
  fileUrl: string;
  uploadedAt: string;
  uploadedBy?: string;
}

export interface EmployeeActivity {
  id: string;
  employeeId: string;
  actionType: 'CREATED' | 'EDITED' | 'STATUS_CHANGED' | 'FILE_UPLOADED' | 'FILE_DELETED' | 'REACTIVATED' | 'ARCHIVED';
  performedBy?: string;
  notes?: string;
  timestamp: string;
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  position?: number;
}

export interface Invoice {
  id: string;
  client: string;
  clientEmail?: string;
  clientAddress?: string;
  amount: string;
  status: 'Paid' | 'Pending' | 'Overdue' | 'Partially Paid';
  date: string;
  dueDate: string;
  items?: InvoiceItem[];
  notes?: string;
  taxRate?: number;
  discount?: number;
  discountType?: 'percentage' | 'fixed';
  deposit?: number;
  paymentMethod?: string;
  clientId?: string;
  _dbId?: string;
  showSignature?: boolean;
  showStamp?: boolean;
  deliveryNoteEnabled?: boolean;
  deliveryNoteTitle?: string;
  deliveryNoteContent?: string;
  createdAt: string;
}

export interface Subscription {
  id: string;
  client: string;
  clientEmail?: string;
  clientId: string;
  packageId?: string; // Link to a Package
  serviceId?: string; // Link to a Service
  plan: string; // Dynamic plan name (e.g. Package name or Service name)
  amount: string;
  billingCycle: 'Monthly' | 'Quarterly' | 'Annual';
  startDate: string;
  endDate: string;
  status: 'Active' | 'Paused' | 'Cancelled' | 'Trial' | 'Ended';
  features?: string[];
  notes?: string;
  createdAt: string;
}

/** Minimal fields returned by GET /api/verify/:token (public). */
export interface PublicVerificationDocument {
  documentNumber?: string;
  date?: string;
  status: string;
  amountFormatted?: string;
  clientMask?: string;
  plan?: string;
  startDate?: string;
  endDate?: string;
  title?: string;
  month?: number;
  year?: number;
  // HR fields
  employeeName?: string;
  employeePosition?: string;
  dateCreated?: string;
  docType?: string;
}

export interface Proforma {
  id: string;
  client: string;
  clientEmail?: string;
  amount: string;
  status: 'Draft' | 'Sent' | 'Accepted' | 'Expired' | 'Partially Paid';
  date: string;
  dueDate: string;
  items?: InvoiceItem[];
  notes?: string;
  taxRate?: number;
  discount?: number;
  discountType?: 'percentage' | 'fixed';
  deposit?: number;
  clientId?: string;
  _dbId?: string;
  showSignature?: boolean;
  showStamp?: boolean;
  deliveryNoteEnabled?: boolean;
  deliveryNoteTitle?: string;
  deliveryNoteContent?: string;
  createdAt: string;
}

export interface PackageDeliverable {
  id?: string;
  name: string;
  type: 'POST' | 'STORY' | 'REEL' | 'SHORT' | 'VIDEO' | 'REPORT' | 'OTHER';
  quantity: number;
  description?: string;
  platforms: ('INSTAGRAM' | 'FACEBOOK' | 'TIKTOK' | 'LINKEDIN' | 'X' | 'SNAPCHAT' | 'YOUTUBE' | 'PINTEREST' | 'OTHER')[];
}

export interface Package {
  id: string;
  name: string;
  description: string;
  price: string;
  features: string[];
  type: 'Service' | 'Subscription' | 'One-time';
  serviceIds?: string[]; // IDs of services included in this package
  deliverables?: PackageDeliverable[];
}

export interface Service {
  id: string;
  name: string;
  category: string;
  basePrice: string;
  description: string;
  status: 'Available' | 'Unavailable';
}

export interface Lead {
  id: string;
  email: string;
  status: string;
  createdAt: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'MANAGER' | 'STAFF' | 'CLIENT';
  teamMemberId?: string | null;
  teamMember?: {
    id: string;
    name: string;
    role: string;
  } | null;
  client?: {
    id: string;
    company: string;
  } | null;
  createdAt: string;
}

export interface VerificationRecord {
  token: string;
  documentType: 'invoice' | 'proforma' | 'subscription' | 'monthly_report';
  documentId: string;
  createdAt: string;
}

export interface PaymentMethod {
  id: string;
  name: string;
  type: 'stripe' | 'paypal' | 'bank' | 'other';
  details: string;
  isActive: boolean;
  image?: string;
}

export interface SocialLink {
  id: string;
  platform: string;
  icon: string;  // Font Awesome class, e.g. "fa-facebook-f"
  url: string;
}

export interface VersionEntry {
  version: string;
  description: string;
  author: string;
  date: string;
}

export interface HrDocument {
  id: string;
  employeeId: string;
  docType: 'WORK_CERTIFICATE' | 'SALARY_CERTIFICATE' | 'PAYSLIP' | 'WARNING_CERTIFICATE' | 'INTERNSHIP_ACCEPTED_CERTIFICATE' | 'INTERNSHIP_LETTER';
  docNumber: string;
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'FINAL';
  generatedById?: string;
  generatedBy?: {
    id: string;
    name: string;
    email: string;
  };
  generatedAt: string;
  approvedById?: string;
  approvedBy?: {
    id: string;
    name: string;
    email: string;
  };
  approvedAt?: string;
  version: number;
  pdfUrl?: string;
  content?: any;
  employee: {
    id: string;
    name: string;
    email: string;
    department?: string;
    role?: string;
    manager?: {
      id: string;
      name: string;
      userId?: string;
    }
  };
  approvals?: HrDocumentApproval[];
}

export interface HrDocumentApproval {
  id: string;
  hrDocumentId: string;
  approverId: string;
  decision: 'APPROVED' | 'REJECTED';
  comment?: string;
  decidedAt: string;
  approver?: {
    id: string;
    name: string;
  };
}

export interface AgencySettings {
  agencyName: string;
  adminEmail: string;
  phone: string;
  website: string;
  address: string;
  currency: string;
  timezone: string;
  logo: string;
  whiteLogo: string;
  favicon: string;
  signature: string;
  stamp: string;
  hrFallbackApproverId?: string | null;
  primaryColor: string;
  taxRate: number;
  defaultInvoiceNotes: string;
  enableRecaptcha: boolean;
  recaptchaSiteKey: string;
  recaptchaSecretKey: string;
  googleAnalyticsEnabled: boolean;
  googleAnalyticsMeasurementId: string;
  developmentMode: boolean;
  comingSoonMessage: string;
  paymentMethods: PaymentMethod[];
  socialLinks: SocialLink[];
  notifications: {
    emailAlerts: boolean;
    projectUpdates: boolean;
    billingAlerts: boolean;
  };
  openAiApiKey: string;
  claudeApiKey: string;
  geminiApiKey: string;
  mainAiProvider: 'openai' | 'claude' | 'gemini';
  resendApiKey: string;
  emailFrom: string;
  mailerName: string;
  smtpHost: string;
  smtpPort: number;
  smtpUsername: string;
  smtpEncryption: string;
  smtpDriver: string;
  mailEnabled: boolean;
  googleDriveFolderId: string;
  googleDriveServiceAccountJson: string;
  googleDriveClientId: string;
  googleDriveClientSecret: string;
  googleDriveRefreshToken: string;
  googleDriveEnabled: boolean;
  oneSignalAppId: string;
  oneSignalApiKey: string;
  oneSignalEnabled: boolean;
  appVersion: string;
  versionHistory: VersionEntry[];
  updatedAt: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  category: 'ACTION_REQUIRED' | 'INFORMATION' | 'SUCCESS' | 'WARNING';
  entityType?: string;
  entityId?: string;
  actionUrl?: string;
  read: boolean;
  createdAt: string;
}

export interface TaskAnalytics {
  velocity: { date: string; count: number }[];
  warnings: {
    id: string;
    label: string;
    client: string;
    plan: string;
    progress: number;
    total: number;
    completed: number;
  }[];
  workload: {
    id: string;
    name: string;
    count: number;
  }[];
}

interface AgencyStore {
  clients: Client[];
  projects: Project[];
  team: TeamMember[];
  invoices: Invoice[];
  subscriptions: Subscription[];
  proformas: Proforma[];
  packages: Package[];
  services: Service[];
  leads: Lead[];
  users: User[];
  settings: AgencySettings;
  taskAnalytics: TaskAnalytics | null;
  globalUploadProgress: number;
  isGlobalUploading: boolean;

  addClient: (client: Omit<Client, 'id' | 'createdAt'>) => Promise<Client>;
  updateClient: (id: string, client: Partial<Client>) => Promise<void>;
  updateClientPortalAccess: (id: string, portalAccess: Record<string, boolean>) => Promise<void>;
  deleteClient: (id: string) => Promise<void>;

  addProject: (project: Omit<Project, 'id'>) => Promise<void>;
  updateProject: (id: string, project: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;

  addTeamMember: (member: Omit<TeamMember, 'id'>) => Promise<TeamMember>;
  updateTeamMember: (id: string, member: Partial<TeamMember>) => Promise<void>;
  deleteTeamMember: (id: string) => Promise<void>;
  fetchEmployeeFiles: (employeeId: string) => Promise<EmployeeFile[]>;
  uploadEmployeeFile: (employeeId: string, file: File, category: string, label: string) => Promise<EmployeeFile>;
  deleteEmployeeFile: (employeeId: string, fileId: string) => Promise<void>;
  fetchEmployeeActivity: (employeeId: string) => Promise<EmployeeActivity[]>;
  provisionEmployeeAccess: (employeeId: string, payload: { password?: string; role?: string }) => Promise<any>;

  hrDocuments: HrDocument[];
  fetchHrDocuments: (params?: { pendingApproval?: boolean; employeeId?: string }) => Promise<HrDocument[]>;
  fetchHrDocumentsForEmployee: (employeeId: string) => Promise<HrDocument[]>;
  fetchHrDocumentById: (id: string) => Promise<HrDocument>;
  createHrDocument: (payload: { employeeId: string; docType: string; docNumber?: string; content: any; status?: string }) => Promise<HrDocument>;
  uploadHrDocumentPdf: (id: string, pdfBase64: string) => Promise<HrDocument>;
  approveHrDocument: (id: string, comment?: string) => Promise<HrDocument>;
  rejectHrDocument: (id: string, comment: string) => Promise<HrDocument>;
  sendHrDocumentEmail: (id: string, payload: { to: string; cc?: string; subject: string; body: string; pdfBase64?: string; filename?: string }) => Promise<any>;

  addInvoice: (invoice: Omit<Invoice, 'id'> & { id?: string }) => Promise<void>;
  updateInvoice: (id: string, invoice: Partial<Invoice>) => Promise<void>;
  deleteInvoice: (id: string) => Promise<void>;

  addSubscription: (subscription: Omit<Subscription, 'id'>) => Promise<void>;
  updateSubscription: (id: string, subscription: Partial<Subscription>) => Promise<void>;
  deleteSubscription: (id: string) => Promise<void>;

  addProforma: (proforma: Omit<Proforma, 'id'> & { id?: string }) => Promise<void>;
  updateProforma: (id: string, proforma: Partial<Proforma>) => Promise<any>;
  deleteProforma: (id: string) => Promise<void>;

  addPackage: (pkg: Omit<Package, 'id'>) => Promise<void>;
  updatePackage: (id: string, pkg: Partial<Package>) => Promise<void>;
  deletePackage: (id: string) => Promise<void>;

  addService: (service: Omit<Service, 'id'>) => Promise<void>;
  updateService: (id: string, service: Partial<Service>) => Promise<void>;
  deleteService: (id: string) => Promise<void>;
  deleteLead: (id: string) => Promise<void>;
  updateLeadStatus: (id: string, status: string) => Promise<void>;

  fetchUsers: () => Promise<void>;
  addUser: (user: Omit<User, 'id' | 'createdAt'> & { password?: string }) => Promise<void>;
  updateUser: (id: string, user: Partial<User> & { password?: string }) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;

  updateSettings: (settings: Partial<AgencySettings>) => Promise<void>;
  getVerificationToken: (documentType: 'invoice' | 'proforma' | 'subscription' | 'monthly_report' | 'hr_document', documentId: string) => Promise<string>;
  verifyDocument: (token: string) => Promise<{ type: 'invoice' | 'proforma' | 'subscription' | 'monthly_report' | 'hr_document'; document: PublicVerificationDocument } | null>;

  fetchClients: () => Promise<void>;
  fetchProjects: () => Promise<void>;
  fetchInvoices: () => Promise<void>;
  fetchSubscriptions: () => Promise<void>;
  fetchProformas: () => Promise<void>;
  fetchPackages: () => Promise<void>;
  fetchServices: () => Promise<void>;
  fetchTeam: () => Promise<void>;
  fetchSettings: () => Promise<void>;
  fetchLeads: () => Promise<void>;
  fetchTaskAnalytics: () => Promise<void>;
  fetchAllData: () => Promise<void>;
  generatePortalAccess: (clientId: string) => Promise<{ tempPassword: string }>;
  uploadFile: (file: File, onProgress?: (progress: number) => void, isPrivate?: boolean) => Promise<string>;
}

const createDefaultSettings = (): AgencySettings => ({
  agencyName: "",
  adminEmail: "",
  phone: "",
  website: "",
  address: "",
  currency: "DJF",
  timezone: "Africa/Djibouti",
  logo: "https://placehold.co/200x60/504188/white?text=LOGO",
  whiteLogo: "https://placehold.co/200x60/white/504188?text=LOGO",
  favicon: "https://placehold.co/32x32/504188/white?text=H",
  signature: "",
  stamp: "",
  primaryColor: "#504188",
  taxRate: 15,
  defaultInvoiceNotes: "Thank you for your business! Please make payment within 14 days.",
  enableRecaptcha: false,
  recaptchaSiteKey: "",
  recaptchaSecretKey: "",
  googleAnalyticsEnabled: false,
  googleAnalyticsMeasurementId: "",
  developmentMode: false,
  comingSoonMessage: "",
  paymentMethods: [],
  socialLinks: [],
  notifications: {
    emailAlerts: true,
    projectUpdates: true,
    billingAlerts: true,
  },
  openAiApiKey: "",
  claudeApiKey: "",
  geminiApiKey: "",
  mainAiProvider: "openai" as const,
  resendApiKey: "",
  emailFrom: "",
  mailerName: "",
  smtpHost: "smtp.resend.com",
  smtpPort: 587,
  smtpUsername: "resend",
  smtpEncryption: "tls",
  smtpDriver: "smtp",
  mailEnabled: false,
  googleDriveFolderId: "",
  googleDriveServiceAccountJson: "",
  googleDriveClientId: "",
  googleDriveClientSecret: "",
  googleDriveRefreshToken: "",
  googleDriveEnabled: false,
  oneSignalAppId: "",
  oneSignalApiKey: "",
  oneSignalEnabled: false,
  appVersion: "2.26.17",
  versionHistory: [
    {
      version: "2.23.0",
      description: "feat: implement Meta and multi-platform social media publishing, scheduling, analytics, and account management",
      author: "Antigravity",
      date: "2026-07-17T06:17:00.000Z",
    },
    {
      version: "2.19.0",
      description: "feat: implement centralized notification system, update brand assets, update client portal dashboard, update invoice numbering and PDF layouts, add client meetings section, and general bug fixes",
      author: "Abdihakim",
      date: "2026-07-16T16:43:00.000Z",
    },
    {
      version: "2.14.0",
      description: "feat: add Google Drive OAuth integration, support redirect URI authorization callback, resolve sidebar page flickering, and fix financial page crash",
      author: "Antigravity",
      date: "2026-07-16T00:36:00.000Z",
    },
    {
      version: "2.13.0",
      description: "feat: upgrade client subscription model with custom billing periods, pricing, and automated invoice generation",
      author: "Abdihakim",
      date: "2026-07-15T20:00:00.000Z",
    },
    {
      version: "2.11.2",
      description: "feat: add ComingSoon page, fix landing page header/footer, expand AI providers, update settings/accounts routes, improve invoice and expense modals, and enhance dashboard overview",
      author: "Abdihakim",
      date: "2026-07-15T13:43:16.000Z",
    },
    {
      version: "2.11.1",
      description: "fix: build and deploy landing page to hirdanmarketing.com on every push",
      author: "Abdihakim",
      date: "2026-07-15T12:31:36.000Z",
    },
    {
      version: "2.11.0",
      description: "chore: add landing-page .gitignore to exclude .next build artifacts, and update landing-page routes",
      author: "Abdihakim",
      date: "2026-07-15T01:58:24.000Z",
    },
    {
      version: "2.9.0",
      description: "feat: add AI assistant page, landing page editor, plugins page, expanded AI integrations (OpenAI/Claude/Gemini), and connect landing page sections to dashboard settings",
      author: "Antigravity",
      date: "2026-07-15T01:48:00.000Z",
    },
    {
      version: "2.8.0",
      description: "feat: implement recurring expenses, associate expenses with employees, and improve financial dashboard and expenses management UI",
      author: "Antigravity",
      date: "2026-07-13T12:38:52.000Z",
    },
    {
      version: "2.7.0",
      description: "feat: update dashboard layouts, support manual file transfer send actions, multi-file zipping and email sharing templates",
      author: "Antigravity",
      date: "2026-07-13T11:01:18.000Z",
    },
    {
      version: "2.5.0",
      description: "feat: WeTransfer-style file transfers, financial modules, employee pages, HR documents & security updates",
      author: "Antigravity",
      date: "2026-07-12T15:38:31.000Z",
    },
    {
      version: "2.1.1",
      description: "feat: setup custom short domain redirect for hirdan.cc and shorten routes to /f/",
      author: "Antigravity",
      date: "2026-07-12T16:37:34.000Z",
    },
    {
      version: "1.6.0",
      description: "feat: add HR Document Generator with Internship Accepted Certificate and Internship Letter templates, and support custom routing & schema updates",
      author: "Antigravity",
      date: "2026-07-09T10:56:16.000Z",
    },
    {
      version: "1.5.0",
      description: "feat: add quick expenses, receipt scan, and financial accounts management",
      author: "Antigravity",
      date: "2026-07-09T09:47:09.000Z",
    },
    {
      version: "1.2.13",
      description: "fix: update mail config to support custom recipient test email and remove restrictive API key requirements for saving SMTP settings",
      author: "Antigravity",
      date: "2026-07-07T10:00:00.000Z",
    },
    {
      version: "1.2.10",
      description: "refactor: reorganize settings page layout into a premium sidebar structure with grouped sections and mobile optimization",
      author: "Antigravity",
      date: "2026-07-06T10:00:00.000Z",
    },
    {
      version: "1.2.8",
      description: "fix: align proforma-to-invoice conversion in ProformaPage list view with ProformaDetailsPage and pass generated invoiceId",
      author: "System",
      date: "2026-07-05T10:00:00.000Z",
    },
    {
      version: "1.2.5",
      description: "feat: map clientId for subscriptions to support client-specific lookups and clean up unused imports in SocialMediaPlannerPage",
      author: "System",
      date: "2026-07-04T10:00:00.000Z",
    },
    {
      version: "1.2.4",
      description: "fix: proforma-to-invoice conversion — correct tax/discount calculation order to match server, fix missing dueDate fallback, and omit pre-computed amount to prevent server mismatch errors",
      author: "System",
      date: "2026-07-03T10:00:00.000Z",
    },
    {
      version: "1.2.3",
      description: "fix: update database schema to allow longer descriptions for invoice and proforma line items",
      author: "System",
      date: "2026-07-02T10:00:00.000Z",
    },
    {
      version: "1.1.0",
      description: "feat: replace arrow buttons with drag-handle reordering on invoice & proforma line items — supports drag-and-drop to any position instantly",
      author: "System",
      date: "2026-07-01T10:00:00.000Z",
    },
    {
      version: "1.0.0",
      description: "Initial release",
      author: "System",
      date: "2026-06-25T10:00:00.000Z",
    }
  ],
  updatedAt: "2026-07-15T01:48:00.000Z",
});

export const useAgencyStore = create<AgencyStore>()(
  persist(
    (set, get): AgencyStore => ({
      clients: [],
      projects: [],
      team: [],
      invoices: [],
      subscriptions: [],
      proformas: [],
      packages: [],
      services: [],
      leads: [],
      users: [],
      taskAnalytics: null,
      globalUploadProgress: 0,
      isGlobalUploading: false,
      hrDocuments: [],
      settings: createDefaultSettings(),

      fetchClients: async () => {
        try {
          const res = await apiFetch<{ clients: any[] }>('/clients');
          const mappedClients = res.clients.map(c => ({
            id: c.id,
            name: c.name,
            email: c.email,
            phone: c.phone || '',
            company: c.company,
            website: c.website,
            address: c.address,
            city: c.city,
            country: c.country,
            industry: c.industry,
            notes: c.notes,
            type: (c.type?.charAt(0).toUpperCase() + c.type?.slice(1).toLowerCase()) as any || 'Business',
            status: c.status.charAt(0).toUpperCase() + c.status.slice(1).toLowerCase() as any,
            projects: c._count?.projects || 0,
            revenue: formatCurrency((c.revenue || 0) / 100),
            initials: c.initials || (c.company ? c.company.substring(0, 2).toUpperCase() : c.name.substring(0, 2).toUpperCase()),
            createdAt: c.createdAt,
            userId: c.userId,
            invoiceGenerationDay: c.invoiceGenerationDay,
            paymentReminderDelay: c.paymentReminderDelay,
            overdueNoticeDelay: c.overdueNoticeDelay
          }));
          set({ clients: mappedClients });
        } catch (error) {
          console.error("Failed to fetch clients:", error);
        }
      },

      fetchProjects: async () => {
        try {
          const res = await apiFetch<{ projects: any[] }>('/projects');
          const mapped = res.projects.map(p => ({
            id: p.id,
            name: p.name,
            client: p.client?.company || p.client?.name || 'Unknown',
            description: p.description,
            status: p.status.split('_').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ') as any,
            priority: p.priority.charAt(0).toUpperCase() + p.priority.slice(1).toLowerCase() as any,
            progress: p.progress,
            budget: formatCurrency(p.budget),
            startDate: p.startDate ? p.startDate.split('T')[0] : '',
            dueDate: p.dueDate ? p.dueDate.split('T')[0] : '',
            team: [],
            tags: p.tags ? JSON.parse(p.tags) : [],
            createdAt: p.createdAt
          }));
          set({ projects: mapped });
        } catch (error) {
          console.error("Failed to fetch projects:", error);
        }
      },

      fetchInvoices: async () => {
        try {
          const res = await apiFetch<{ invoices: any[] }>('/invoices');
          const mapped = res.invoices.map(i => ({
            id: i.invoiceNumber || i.id,
            client: i.client?.company || i.client?.name || 'Unknown',
            clientEmail: i.client?.email || '',
            amount: formatCurrency((i.amount || 0) / 100),
            status: i.status.split('_').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ') as any,
            date: i.date.split('T')[0],
            dueDate: i.dueDate.split('T')[0],
            items: (i.items || []).map((item: any) => ({
              description: item.description,
              quantity: item.quantity,
              unitPrice: (item.unitPrice || 0) / 100,
            })),
            taxRate: i.taxRate,
            discount: i.discount,
            discountType: i.discountType ? i.discountType.toLowerCase() as any : undefined,
            deposit: i.deposit ? i.deposit / 100 : undefined,
            paymentMethod: i.paymentMethod,
            notes: i.notes,
            clientId: i.clientId || i.client?.id,
            _dbId: i.id,
            showSignature: i.showSignature,
            showStamp: i.showStamp,
            deliveryNoteEnabled: i.deliveryNoteEnabled,
            deliveryNoteTitle: i.deliveryNoteTitle,
            deliveryNoteContent: i.deliveryNoteContent,
            createdAt: i.createdAt
          }));
          set({ invoices: mapped });
        } catch (error) {
          console.error("Failed to fetch invoices:", error);
        }
      },

      fetchSubscriptions: async () => {
        try {
          const res = await apiFetch<{ subscriptions: any[] }>('/subscriptions');
          const mapped = res.subscriptions.map(s => ({
            id: s.id,
            client: s.client?.company || s.client?.name || 'Unknown',
            clientEmail: s.client?.email || '',
            clientId: s.clientId || s.client?.id || '',
            plan: s.package?.name || s.plan || 'Custom',
            amount: formatCurrency((s.amount || 0) / 100),
            billingCycle: s.billingCycle.charAt(0).toUpperCase() + s.billingCycle.slice(1).toLowerCase() as any,
            startDate: s.startDate ? s.startDate.split('T')[0] : '',
            endDate: s.endDate ? s.endDate.split('T')[0] : 'N/A',
            status: (() => {
              const baseStatus = s.status.charAt(0).toUpperCase() + s.status.slice(1).toLowerCase();
              if ((baseStatus === 'Active' || baseStatus === 'Trial') && s.endDate) {
                const endStr = s.endDate.split('T')[0];
                const todayStr = new Date().toISOString().split('T')[0];
                if (endStr < todayStr) {
                  return 'Ended';
                }
              }
              return baseStatus;
            })() as any,
            features: normalizeFeatureList(s.features),
            packageId: s.packageId,
            createdAt: s.createdAt
          }));
          set({ subscriptions: mapped });
        } catch (error) {
          console.error("Failed to fetch subscriptions:", error);
        }
      },

      fetchProformas: async () => {
        try {
          const res = await apiFetch<{ proformas: any[] }>('/proformas');
          const mapped = res.proformas.map(p => ({
            id: p.proformaNumber || p.id,
            client: p.client?.company || p.client?.name || 'Unknown',
            clientEmail: p.client?.email || '',
            amount: formatCurrency((p.amount || 0) / 100),
            status: p.status.split('_').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ') as any,
            date: p.date.split('T')[0],
            dueDate: p.dueDate?.split('T')[0] || '',
            items: (p.items || []).map((item: any) => ({
              description: item.description,
              quantity: item.quantity,
              unitPrice: (item.unitPrice || 0) / 100,
            })),
            taxRate: p.taxRate,
            discount: p.discount,
            discountType: p.discountType ? p.discountType.toLowerCase() as any : undefined,
            deposit: p.deposit ? p.deposit / 100 : undefined,
            notes: p.notes,
            clientId: p.clientId || p.client?.id,
            _dbId: p.id,
            showSignature: p.showSignature,
            showStamp: p.showStamp,
            deliveryNoteEnabled: p.deliveryNoteEnabled,
            deliveryNoteTitle: p.deliveryNoteTitle,
            deliveryNoteContent: p.deliveryNoteContent,
            createdAt: p.createdAt
          }));
          set({ proformas: mapped });
        } catch (error) {
          console.error("Failed to fetch proformas:", error);
        }
      },

      fetchPackages: async () => {
        try {
          const res = await apiFetch<{ packages: any[] }>('/packages');
          const mapped = res.packages.map(p => {
            // Convert DB enum ONE_TIME -> 'One-time', SUBSCRIPTION -> 'Subscription', SERVICE -> 'Service'
            let typeDisplay: 'Service' | 'Subscription' | 'One-time' = 'Service';
            if (p.type === 'SUBSCRIPTION') typeDisplay = 'Subscription';
            else if (p.type === 'ONE_TIME') typeDisplay = 'One-time';
            else if (p.type === 'SERVICE') typeDisplay = 'Service';
            const priceDisplay = formatCurrency((p.price || 0) / 100) + (p.type === 'SUBSCRIPTION' ? '/mo' : '');
            return {
              id: p.id,
              name: p.name,
              description: p.description,
              price: priceDisplay,
              features: normalizeFeatureList(p.features),
              type: typeDisplay,
              serviceIds: (p.packageServices || []).map((ps: any) => ps.serviceId || ps.service?.id).filter(Boolean),
              deliverables: p.deliverables?.map((d: any) => ({
                id: d.id,
                name: d.name,
                type: d.type,
                quantity: d.quantity,
                description: d.description,
                platforms: d.platforms?.map((plat: any) => plat.platform) || []
              })) || [],
            };
          });
          set({ packages: mapped });
        } catch (error) {
          console.error("Failed to fetch packages:", error);
        }
      },

      fetchServices: async () => {
        try {
          const res = await apiFetch<{ services: any[] }>('/services');
          const mapped = res.services.map(s => ({
            id: s.id,
            name: s.name,
            category: s.category,
            basePrice: formatCurrency((s.basePrice || 0) / 100),
            description: s.description,
            status: s.status.charAt(0).toUpperCase() + s.status.slice(1).toLowerCase() as any
          }));
          set({ services: mapped });
        } catch (error) {
          console.error("Failed to fetch services:", error);
        }
      },

      fetchTeam: async () => {
        try {
          const res = await apiFetch<{ team: any[] }>('/team');
          const mapped = res.team.map(m => {
            const mapBackendStatus = (status: string) => {
              if (status === 'PENDING_DOCUMENTS') return 'Pending Documents';
              if (status === 'DRAFT') return 'Draft';
              if (status === 'ON_LEAVE') return 'On Leave';
              if (status === 'TERMINATED') return 'Terminated';
              return 'Active';
            };

            return {
              id: m.id,
              userId: m.userId,
              name: m.name,
              email: m.email,
              phone: m.phone || '',
              role: m.role || 'Member',
              department: m.department || '',
              status: mapBackendStatus(m.status),
              avatar: m.avatar,
              photoUrl: m.photoUrl || '',
              projects: m._count?.projects || 0,
              hourlyRate: m.hourlyRate ? formatCurrency(m.hourlyRate / 100) : '',
              startDate: m.startDate ? m.startDate.split('T')[0] : m.createdAt.split('T')[0],
              bio: m.bio || '',
              createdAt: m.createdAt,
              archivedAt: m.archivedAt ? m.archivedAt.split('T')[0] : undefined,

              // Personal
              dateOfBirth: m.dateOfBirth || '',
              gender: m.gender || '',
              nationalId: m.nationalId || '',
              nationalIdType: m.nationalIdType || '',
              nationality: m.nationality || '',
              homeAddress: m.homeAddress || '',
              emergencyContactName: m.emergencyContactName || '',
              emergencyContactRelation: m.emergencyContactRelation || '',
              emergencyContactPhone: m.emergencyContactPhone || '',

              // Employment
              employmentType: m.employmentType || '',
              managerId: m.managerId || '',
              workLocation: m.workLocation || '',

              // Payroll
              isHourlyMode: !!m.isHourlyMode,
              basicSalary: m.basicSalary ? formatCurrency(m.basicSalary / 100) : '',
              housingAllowance: m.housingAllowance ? formatCurrency(m.housingAllowance / 100) : '',
              transportAllowance: m.transportAllowance ? formatCurrency(m.transportAllowance / 100) : '',
              otherAllowances: m.otherAllowances || '',
              bankName: m.bankName || '',
              accountNumber: m.accountNumber || '',
              taxId: m.taxId || '',
              paymentMethod: m.paymentMethod || '',
              currency: m.currency || 'USD',
            };
          });
          set({ team: mapped as TeamMember[] });
        } catch (error) {
          console.error("Failed to fetch team:", error);
        }
      },

      fetchSettings: async () => {
        try {
          const res = await apiFetch<{ settings: any }>('/settings');
          if (res.settings) {
            const settings = res.settings;

            // Detect whether this is a full admin response or a stripped guest response.
            // Guest responses omit sensitive fields (API keys, mail config) — we must
            // NOT overwrite the store's existing values for those fields with empty defaults.
            const isAdminResponse = !!settings._isAdminResponse;
            delete settings._isAdminResponse; // strip the flag before storing

            // Handle backward compatibility for paymentMethods
            if (Array.isArray(settings.paymentMethods)) {
              settings.paymentMethods = settings.paymentMethods.map((m: any, idx: number) => {
                if (typeof m === 'string') {
                  return {
                    id: `legacy-${idx}`,
                    name: m,
                    type: 'other',
                    details: '',
                    isActive: true
                  };
                }
                return m;
              });
            }
            // Normalize socialLinks: support both new array format and legacy {facebook, twitter...} object
            let parsedSocialLinks: SocialLink[] = [];
            const rawSocial = settings.socialLinks;
            if (Array.isArray(rawSocial)) {
              parsedSocialLinks = rawSocial;
            } else if (rawSocial && typeof rawSocial === 'object') {
              const iconMap: Record<string, string> = {
                facebook: 'fa-facebook-f',
                twitter: 'fa-twitter',
                instagram: 'fa-instagram',
                linkedin: 'fa-linkedin-in'
              };
              parsedSocialLinks = Object.entries(rawSocial)
                .filter(([, url]) => url)
                .map(([platform, url]) => ({
                  id: platform,
                  platform: platform.charAt(0).toUpperCase() + platform.slice(1),
                  icon: iconMap[platform] || 'fa-globe',
                  url: url as string
                }));
            }

            const defaults = createDefaultSettings();
            const currentSettings = get().settings;

            // Sensitive fields that are ONLY returned in admin responses.
            // If we got a guest response, we keep whatever the store already has
            // for these fields — preventing accidental data loss on save.
            const sensitiveFields: (keyof AgencySettings)[] = [
              'openAiApiKey', 'claudeApiKey', 'geminiApiKey', 'mainAiProvider',
              'resendApiKey', 'emailFrom', 'mailerName',
              'smtpHost', 'smtpPort', 'smtpUsername', 'smtpEncryption', 'smtpDriver',
              'mailEnabled', 'googleDriveFolderId', 'googleDriveServiceAccountJson', 'googleDriveEnabled',
              'googleDriveClientId', 'googleDriveClientSecret', 'googleDriveRefreshToken',
            ];

            const merged: AgencySettings = {
              ...defaults,
              ...settings,
              paymentMethods: settings.paymentMethods ?? defaults.paymentMethods,
              socialLinks: parsedSocialLinks,
              notifications: { ...defaults.notifications, ...(settings.notifications || {}) },
            };

            // Preserve sensitive fields from the current store when the API response
            // is a guest/public response (i.e. those fields weren't returned at all).
            if (!isAdminResponse) {
              for (const field of sensitiveFields) {
                (merged as any)[field] = currentSettings[field];
              }
            }

            set({ settings: merged });
          }
        } catch (error) {
          console.error("Failed to fetch settings:", error);
        }
      },

      fetchLeads: async () => {
        try {
          const res = await apiFetch<{ leads: any[] }>('/leads');
          set({ leads: res.leads });
        } catch (error) {
          console.error("Failed to fetch leads:", error);
        }
      },

      fetchTaskAnalytics: async () => {
        try {
          const res = await apiFetch<TaskAnalytics>('/tasks/analytics/dashboard');
          set({ taskAnalytics: res });
        } catch (error) {
          console.error("Failed to fetch task analytics:", error);
        }
      },

      fetchAllData: async () => {
        await Promise.all([
          get().fetchClients(),
          get().fetchProjects(),
          get().fetchInvoices(),
          get().fetchSubscriptions(),
          get().fetchProformas(),
          get().fetchPackages(),
          get().fetchServices(),
          get().fetchTeam(),
          get().fetchLeads(),
          get().fetchUsers(),
          get().fetchSettings(),
          get().fetchTaskAnalytics()
        ]);
      },

      addClient: async (client) => {
        try {
          // Strip frontend-only fields not in DB schema
          const { revenue, projects, ...clientData } = client as any;
          const res = await apiFetch<{ client: any }>('/clients', {
            method: 'POST',
            body: JSON.stringify({
              ...clientData,
              status: clientData.status.toUpperCase(),
              type: clientData.type.toUpperCase()
            }),
          });
          await get().fetchClients();

          // Map DB client back to Frontend Client format
          const c = res.client;
          return {
            id: c.id,
            name: c.name,
            email: c.email,
            phone: c.phone || '',
            company: c.company,
            website: c.website,
            address: c.address,
            city: c.city,
            country: c.country,
            industry: c.industry,
            notes: c.notes,
            type: (c.type?.charAt(0).toUpperCase() + c.type?.slice(1).toLowerCase()) as any || 'Business',
            status: c.status.charAt(0).toUpperCase() + c.status.slice(1).toLowerCase() as any,
            projects: c._count?.projects || 0,
            revenue: formatCurrency((c.revenue || 0) / 100),
            initials: c.initials || (c.company ? c.company.substring(0, 2).toUpperCase() : c.name.substring(0, 2).toUpperCase()),
            createdAt: c.createdAt,
            userId: c.userId
          } as Client;
        } catch (error) {
          console.error("Failed to add client:", error);
          throw error;
        }
      },

      updateClientPortalAccess: async (id, portalAccess) => {
        try {
          const res = await apiFetch<{ client: any }>(`/clients/${id}/portal-access`, {
            method: 'PATCH',
            body: JSON.stringify({ portalAccess }),
          });
          set((state) => ({
            clients: state.clients.map((c) =>
              c.id === id ? { ...c, portalAccess: res.client.portalAccess } : c
            ),
          }));
        } catch (error) {
          console.error("Failed to update client portal access:", error);
          throw error;
        }
      },

      updateClient: async (id, client) => {
        try {
          const { id: _, createdAt, userId, revenue, projects, ...clientData } = client as any;
          const payload = { ...clientData };
          if (payload.status) payload.status = payload.status.toUpperCase();
          if (payload.type) payload.type = payload.type.toUpperCase();

          await apiFetch(`/clients/${id}`, {
            method: 'PUT',
            body: JSON.stringify(payload),
          });
          await get().fetchClients();
        } catch (error) {
          console.error("Failed to update client:", error);
          throw error;
        }
      },

      deleteClient: async (id) => {
        try {
          await apiFetch(`/clients/${id}`, { method: 'DELETE' });
          await get().fetchClients();
        } catch (error) {
          console.error("Failed to delete client:", error);
          throw error;
        }
      },

      addProject: async (project) => {
        try {
          // Resolve clientId from company/name match
          const clients = get().clients;
          const matched = clients.find(c => c.company === project.client || c.name === project.client);
          if (!matched) throw new Error(`Client not found: ${project.client}`);
          const budgetCents = project.budget
            ? Math.round(parseFloat(String(project.budget).replace(/[^0-9.]/g, '')) * 100)
            : undefined;
          await apiFetch('/projects', {
            method: 'POST',
            body: JSON.stringify({
              name: project.name,
              clientId: matched.id,
              description: project.description || undefined,
              status: project.status.toUpperCase().replace(/ /g, '_'),
              priority: project.priority.toUpperCase(),
              progress: project.progress ?? 0,
              budget: budgetCents,
              startDate: project.startDate ? new Date(project.startDate).toISOString() : undefined,
              dueDate: project.dueDate ? new Date(project.dueDate).toISOString() : undefined,
              tags: project.tags?.length ? JSON.stringify(project.tags) : undefined,
            }),
          });
          await get().fetchProjects();
        } catch (error) {
          console.error("Failed to add project:", error);
          throw error;
        }
      },
      updateProject: async (id, project) => {
        try {
          const payload: any = { ...project };
          // Resolve clientId if client name provided
          if (payload.client) {
            const clients = get().clients;
            const matched = clients.find((c: any) => c.company === payload.client || c.name === payload.client);
            if (matched) payload.clientId = matched.id;
            delete payload.client;
          }
          if (payload.status) payload.status = payload.status.toUpperCase().replace(/ /g, '_');
          if (payload.priority) payload.priority = payload.priority.toUpperCase();
          if (payload.budget !== undefined) {
            payload.budget = payload.budget
              ? Math.round(parseFloat(String(payload.budget).replace(/[^0-9.]/g, '')) * 100)
              : undefined;
          }
          if (payload.startDate) payload.startDate = new Date(payload.startDate).toISOString();
          if (payload.dueDate) payload.dueDate = new Date(payload.dueDate).toISOString();
          if (payload.tags !== undefined) {
            payload.tags = payload.tags?.length ? JSON.stringify(payload.tags) : undefined;
          }
          // Remove frontend-only fields
          delete payload.team;
          await apiFetch(`/projects/${id}`, {
            method: 'PUT',
            body: JSON.stringify(payload),
          });
          await get().fetchProjects();
        } catch (error) {
          console.error("Failed to update project:", error);
          throw error;
        }
      },
      deleteProject: async (id) => {
        try {
          await apiFetch(`/projects/${id}`, { method: 'DELETE' });
          await get().fetchProjects();
        } catch (error) {
          console.error("Failed to delete project:", error);
          throw error;
        }
      },

      addTeamMember: async (member) => {
        try {
          const cleanCurrencyToCents = (val: any) => {
            if (val === undefined || val === null || val === '') return undefined;
            const num = parseFloat(String(val).replace(/[^0-9.]/g, ''));
            return isNaN(num) ? undefined : Math.round(num * 100);
          };

          const mapFrontendStatus = (status?: string) => {
            if (!status) return 'DRAFT';
            if (status === 'Pending Documents') return 'PENDING_DOCUMENTS';
            if (status === 'Draft') return 'DRAFT';
            if (status === 'On Leave') return 'ON_LEAVE';
            if (status === 'Terminated') return 'TERMINATED';
            return 'ACTIVE';
          };

          const isValidDate = (val: any) => {
            if (!val) return false;
            const d = new Date(val);
            return d instanceof Date && !isNaN(d.getTime());
          };

          const hourlyRateCents = cleanCurrencyToCents(member.hourlyRate);
          const basicSalaryCents = cleanCurrencyToCents(member.basicSalary);
          const housingAllowanceCents = cleanCurrencyToCents(member.housingAllowance);
          const transportAllowanceCents = cleanCurrencyToCents(member.transportAllowance);

          const { projects, ...memberData } = member as any;
          // Strip empty string foreign keys that would fail DB constraints
          if (memberData.managerId === '' || memberData.managerId === undefined) delete memberData.managerId;

          const res = await apiFetch<{ member: any }>('/team', {
            method: 'POST',
            body: JSON.stringify({
              ...memberData,
              hourlyRate: hourlyRateCents,
              basicSalary: basicSalaryCents,
              housingAllowance: housingAllowanceCents,
              transportAllowance: transportAllowanceCents,
              status: mapFrontendStatus(member.status),
              startDate: isValidDate(member.startDate) ? new Date(member.startDate).toISOString() : undefined,
            }),
          });
          await get().fetchTeam();
          return res.member;
        } catch (error) {
          console.error("Failed to add team member:", error);
          throw error;
        }
      },
      updateTeamMember: async (id, member) => {
        try {
          const cleanCurrencyToCents = (val: any) => {
            if (val === undefined || val === null || val === '') return undefined;
            const num = parseFloat(String(val).replace(/[^0-9.]/g, ''));
            return isNaN(num) ? undefined : Math.round(num * 100);
          };

          const mapFrontendStatus = (status?: string) => {
            if (!status) return undefined;
            if (status === 'Pending Documents') return 'PENDING_DOCUMENTS';
            if (status === 'Draft') return 'DRAFT';
            if (status === 'On Leave') return 'ON_LEAVE';
            if (status === 'Terminated') return 'TERMINATED';
            return 'ACTIVE';
          };

          const isValidDate = (val: any) => {
            if (!val) return false;
            const d = new Date(val);
            return d instanceof Date && !isNaN(d.getTime());
          };

          const { projects, ...memberData } = member as any;
          const payload: any = { ...memberData };
          
          if (payload.status) payload.status = mapFrontendStatus(payload.status);
          
          if (payload.startDate !== undefined) {
            payload.startDate = isValidDate(payload.startDate) ? new Date(payload.startDate).toISOString() : null;
          }

          // Strip empty string foreign keys — empty string "" fails DB FK constraints
          if (payload.managerId === '' || payload.managerId === undefined) payload.managerId = null;
          
          if (payload.hourlyRate !== undefined) payload.hourlyRate = cleanCurrencyToCents(payload.hourlyRate);
          if (payload.basicSalary !== undefined) payload.basicSalary = cleanCurrencyToCents(payload.basicSalary);
          if (payload.housingAllowance !== undefined) payload.housingAllowance = cleanCurrencyToCents(payload.housingAllowance);
          if (payload.transportAllowance !== undefined) payload.transportAllowance = cleanCurrencyToCents(payload.transportAllowance);

          await apiFetch(`/team/${id}`, {
            method: 'PUT',
            body: JSON.stringify(payload),
          });
          await get().fetchTeam();
        } catch (error) {
          console.error("Failed to update team member:", error);
          throw error;
        }
      },
      deleteTeamMember: async (id) => {
        try {
          await apiFetch(`/team/${id}`, { method: 'DELETE' });
          await get().fetchTeam();
        } catch (error) {
          console.error("Failed to delete team member:", error);
          throw error;
        }
      },
      fetchEmployeeFiles: async (employeeId) => {
        try {
          const res = await apiFetch<{ files: EmployeeFile[] }>(`/team/${employeeId}/files`);
          return res.files;
        } catch (error) {
          console.error("Failed to fetch employee files:", error);
          return [];
        }
      },
      uploadEmployeeFile: async (employeeId, file, category, label) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('category', category);
        formData.append('label', label);

        set({ isGlobalUploading: true, globalUploadProgress: 0 });
        try {
          const res = await apiUpload<{ file: EmployeeFile }>(
            `/team/${employeeId}/files`,
            formData,
            (progress) => {
              set({ globalUploadProgress: progress });
            }
          );
          return res.file;
        } finally {
          setTimeout(() => {
            set({ isGlobalUploading: false, globalUploadProgress: 0 });
          }, 1000);
        }
      },
      deleteEmployeeFile: async (employeeId, fileId) => {
        try {
          await apiFetch(`/team/${employeeId}/files/${fileId}`, { method: 'DELETE' });
        } catch (error) {
          console.error("Failed to delete employee file:", error);
          throw error;
        }
      },
      fetchEmployeeActivity: async (employeeId) => {
        try {
          const res = await apiFetch<{ activities: EmployeeActivity[] }>(`/team/${employeeId}/activity`);
          return res.activities;
        } catch (error) {
          console.error("Failed to fetch employee activity:", error);
          return [];
        }
      },
      provisionEmployeeAccess: async (employeeId, payload) => {
        try {
          const res = await apiFetch<any>(`/team/${employeeId}/provision-access`, {
            method: 'POST',
            body: JSON.stringify(payload),
          });
          // Refresh team data to pick up the user linkage
          await get().fetchTeam();
          return res;
        } catch (error) {
          console.error("Failed to provision system access:", error);
          throw error;
        }
      },

      fetchHrDocuments: async (params) => {
        try {
          const query = new URLSearchParams();
          if (params?.pendingApproval) query.append('pendingApproval', 'true');
          if (params?.employeeId) query.append('employeeId', params.employeeId);
          
          const res = await apiFetch<{ documents: HrDocument[] }>(`/hr/documents?${query.toString()}`);
          set({ hrDocuments: res.documents });
          return res.documents;
        } catch (error) {
          console.error("Failed to fetch HR documents:", error);
          return [];
        }
      },
      fetchHrDocumentsForEmployee: async (employeeId) => {
        try {
          const res = await apiFetch<{ documents: HrDocument[] }>(`/hr/documents/employee/${employeeId}`);
          return res.documents;
        } catch (error) {
          console.error("Failed to fetch HR documents for employee:", error);
          return [];
        }
      },
      fetchHrDocumentById: async (id) => {
        try {
          const res = await apiFetch<{ document: HrDocument }>(`/hr/documents/${id}`);
          return res.document;
        } catch (error) {
          console.error("Failed to fetch HR document by ID:", error);
          throw error;
        }
      },
      createHrDocument: async (payload) => {
        try {
          const res = await apiFetch<{ document: HrDocument }>(`/hr/documents`, {
            method: 'POST',
            body: JSON.stringify(payload),
          });
          return res.document;
        } catch (error) {
          console.error("Failed to create HR document:", error);
          throw error;
        }
      },
      uploadHrDocumentPdf: async (id, pdfBase64) => {
        try {
          const res = await apiFetch<{ document: HrDocument }>(`/hr/documents/${id}/pdf`, {
            method: 'POST',
            body: JSON.stringify({ pdfBase64 }),
          });
          return res.document;
        } catch (error) {
          console.error("Failed to upload HR document PDF:", error);
          throw error;
        }
      },
      approveHrDocument: async (id, comment) => {
        try {
          const res = await apiFetch<{ document: HrDocument }>(`/hr/documents/${id}/approve`, {
            method: 'POST',
            body: JSON.stringify({ comment }),
          });
          return res.document;
        } catch (error) {
          console.error("Failed to approve HR document:", error);
          throw error;
        }
      },
      rejectHrDocument: async (id, comment) => {
        try {
          const res = await apiFetch<{ document: HrDocument }>(`/hr/documents/${id}/reject`, {
            method: 'POST',
            body: JSON.stringify({ comment }),
          });
          return res.document;
        } catch (error) {
          console.error("Failed to reject HR document:", error);
          throw error;
        }
      },
      sendHrDocumentEmail: async (id, payload) => {
        try {
          const res = await apiFetch<any>(`/hr/documents/${id}/send-email`, {
            method: 'POST',
            body: JSON.stringify(payload),
          });
          return res;
        } catch (error) {
          console.error("Failed to send HR document email:", error);
          throw error;
        }
      },

      addInvoice: async (invoice) => {
        try {
          let clientId = (invoice as any).clientId;
          if (!clientId) {
            const clients = get().clients;
            const matched = clients.find(c => c.company === invoice.client || c.name === invoice.client);
            if (!matched) throw new Error(`Client not found: ${invoice.client}`);
            clientId = matched.id;
          }
          // Convert money values to cents (DB stores in cents)
          // Only compute amountCents when invoice.amount is explicitly provided;
          // when omitted the server will compute from items (avoids mismatch errors).
          const amountCents = invoice.amount
            ? Math.round(parseFloat(String(invoice.amount).replace(/[^0-9.]/g, '')) * 100)
            : undefined;
          const depositCents = invoice.deposit != null
            ? Math.round(Number(invoice.deposit) * 100)
            : undefined;
          // items unitPrice -> cents
          const itemsForDB = (invoice.items || []).map((item, index) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: Math.round(Number(item.unitPrice) * 100),
            position: item.position !== undefined ? item.position : index,
          }));
          await apiFetch('/invoices', {
            method: 'POST',
            body: JSON.stringify({
              invoiceNumber: (invoice as any).id || invoice.id,
              clientId,
              ...(amountCents !== undefined ? { amount: amountCents } : {}),
              status: invoice.status.toUpperCase().replace(/\s+/g, '_'),
              date: invoice.date ? new Date(invoice.date).toISOString() : new Date().toISOString(),
              dueDate: invoice.dueDate ? new Date(invoice.dueDate).toISOString() : undefined,
              taxRate: invoice.taxRate,
              discount: invoice.discount,
              discountType: invoice.discountType ? invoice.discountType.toUpperCase() : undefined,
              deposit: depositCents,
              paymentMethod: invoice.paymentMethod,
              notes: invoice.notes,
              showSignature: invoice.showSignature,
              showStamp: invoice.showStamp,
              deliveryNoteEnabled: invoice.deliveryNoteEnabled,
              deliveryNoteTitle: invoice.deliveryNoteTitle,
              deliveryNoteContent: invoice.deliveryNoteContent,
              items: itemsForDB,
            }),
          });
          await get().fetchInvoices();
        } catch (error) {
          console.error("Failed to add invoice:", error);
          throw error;
        }
      },
      updateInvoice: async (id, invoice) => {
        try {
          const payload: any = {};
          if (invoice.status) payload.status = invoice.status.toUpperCase().replace(/\s+/g, '_');
          if (invoice.date) payload.date = new Date(invoice.date).toISOString();
          if (invoice.dueDate) payload.dueDate = new Date(invoice.dueDate).toISOString();
          if (invoice.taxRate !== undefined) payload.taxRate = invoice.taxRate;
          if (invoice.discount !== undefined) payload.discount = invoice.discount;
          if (invoice.discountType) payload.discountType = invoice.discountType.toUpperCase();
          if (invoice.paymentMethod) payload.paymentMethod = invoice.paymentMethod;
          if (invoice.notes !== undefined) payload.notes = invoice.notes;
          if (invoice.showSignature !== undefined) payload.showSignature = invoice.showSignature;
          if (invoice.showStamp !== undefined) payload.showStamp = invoice.showStamp;
          if (invoice.deliveryNoteEnabled !== undefined) payload.deliveryNoteEnabled = invoice.deliveryNoteEnabled;
          if (invoice.deliveryNoteTitle !== undefined) payload.deliveryNoteTitle = invoice.deliveryNoteTitle;
          if (invoice.deliveryNoteContent !== undefined) payload.deliveryNoteContent = invoice.deliveryNoteContent;
          if (invoice.deposit != null) payload.deposit = Math.round(Number(invoice.deposit) * 100);
          if (invoice.clientId) payload.clientId = invoice.clientId;
          if (invoice.client && !payload.clientId) {
            const clients = get().clients;
            const matched = clients.find((c: any) => c.company === invoice.client || c.name === invoice.client);
            if (matched) payload.clientId = matched.id;
          }
          if (invoice.amount) {
            payload.amount = Math.round(parseFloat(String(invoice.amount).replace(/[^0-9.]/g, '')) * 100);
          }
          if (invoice.items) {
            payload.items = invoice.items.map((item, index) => ({
              description: item.description,
              quantity: item.quantity,
              unitPrice: Math.round(Number(item.unitPrice) * 100),
              position: item.position !== undefined ? item.position : index,
            }));
          }
          if (invoice.id && invoice.id.startsWith('INV-')) {
            payload.invoiceNumber = invoice.id;
          }
          // Resolve _dbId if the display-id (invoiceNumber) was used
          const allInvoices = get().invoices;
          const found = allInvoices.find((inv: any) => inv.id === id || inv._dbId === id);
          const dbId = (found as any)?._dbId || id;
          await apiFetch(`/invoices/${dbId}`, {
            method: 'PUT',
            body: JSON.stringify(payload),
          });
          await get().fetchInvoices();
        } catch (error) {
          console.error("Failed to update invoice:", error);
          throw error;
        }
      },
      deleteInvoice: async (id) => {
        try {
          const allInvoices = get().invoices;
          const found = allInvoices.find((inv: any) => inv.id === id || inv._dbId === id);
          const dbId = (found as any)?._dbId || id;
          await apiFetch(`/invoices/${dbId}`, { method: 'DELETE' });
          await get().fetchInvoices();
        } catch (error) {
          console.error("Failed to delete invoice:", error);
          throw error;
        }
      },

      addSubscription: async (subscription) => {
        try {
          const clients = get().clients;
          const matched = clients.find(c => c.company === subscription.client || c.name === subscription.client);
          if (!matched) throw new Error(`Client not found: ${subscription.client}`);
          const amountCents = subscription.amount
            ? Math.round(parseFloat(String(subscription.amount).replace(/[^0-9.]/g, '')) * 100)
            : 0;
          const featureList = normalizeFeatureList(subscription.features);
          const featuresJson = featureList.length ? JSON.stringify(featureList) : undefined;
          await apiFetch('/subscriptions', {
            method: 'POST',
            body: JSON.stringify({
              clientId: matched.id,
              packageId: subscription.packageId || undefined,
              plan: subscription.plan,
              amount: amountCents,
              billingCycle: subscription.billingCycle.toUpperCase(),
              startDate: subscription.startDate ? new Date(subscription.startDate).toISOString() : new Date().toISOString(),
              endDate: subscription.endDate && subscription.endDate !== 'N/A' ? new Date(subscription.endDate).toISOString() : undefined,
              status: subscription.status === 'Ended' ? 'ACTIVE' : subscription.status.toUpperCase(),
              features: featuresJson,
              notes: subscription.notes,
            }),
          });
          await get().fetchSubscriptions();
        } catch (error) {
          console.error("Failed to add subscription:", error);
          throw error;
        }
      },
      updateSubscription: async (id, subscription) => {
        try {
          const payload: any = {};
          if (subscription.status) {
            payload.status = subscription.status === 'Ended' ? 'ACTIVE' : subscription.status.toUpperCase();
          }
          if (subscription.billingCycle) payload.billingCycle = subscription.billingCycle.toUpperCase();
          if (subscription.plan) payload.plan = subscription.plan;
          if (subscription.amount !== undefined) {
            payload.amount = Math.round(parseFloat(String(subscription.amount).replace(/[^0-9.]/g, '')) * 100);
          }
          if (subscription.startDate) payload.startDate = new Date(subscription.startDate).toISOString();
          if (subscription.endDate) {
            payload.endDate = subscription.endDate !== 'N/A' ? new Date(subscription.endDate).toISOString() : undefined;
          }
          if (subscription.features !== undefined) {
            const featureList = normalizeFeatureList(subscription.features);
            payload.features = featureList.length ? JSON.stringify(featureList) : undefined;
          }
          if (subscription.notes !== undefined) payload.notes = subscription.notes;
          if (subscription.client) {
            const clients = get().clients;
            const matched = clients.find((c: any) => c.company === subscription.client || c.name === subscription.client);
            if (matched) payload.clientId = matched.id;
          }
          await apiFetch(`/subscriptions/${id}`, {
            method: 'PUT',
            body: JSON.stringify(payload),
          });
          await get().fetchSubscriptions();
        } catch (error) {
          console.error("Failed to update subscription:", error);
          throw error;
        }
      },
      deleteSubscription: async (id) => {
        try {
          await apiFetch(`/subscriptions/${id}`, { method: 'DELETE' });
          await get().fetchSubscriptions();
        } catch (error) {
          console.error("Failed to delete subscription:", error);
          throw error;
        }
      },

      addProforma: async (proforma) => {
        try {
          const clients = get().clients;
          const matched = clients.find(c => c.company === proforma.client || c.name === proforma.client);
          if (!matched) throw new Error(`Client not found: ${proforma.client}`);
          const amountCents = proforma.amount
            ? Math.round(parseFloat(String(proforma.amount).replace(/[^0-9.]/g, '')) * 100)
            : 0;
          const itemsForDB = (proforma.items || []).map((item, index) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: Math.round(Number(item.unitPrice) * 100),
            position: item.position !== undefined ? item.position : index,
          }));
          await apiFetch('/proformas', {
            method: 'POST',
            body: JSON.stringify({
              proformaNumber: (proforma as any).id || proforma.id,
              clientId: matched.id,
              amount: amountCents,
              status: proforma.status.toUpperCase().replace(/\s+/g, '_'),
              date: proforma.date ? new Date(proforma.date).toISOString() : new Date().toISOString(),
              dueDate: proforma.dueDate ? new Date(proforma.dueDate).toISOString() : undefined,
              taxRate: proforma.taxRate,
              discount: proforma.discount,
              discountType: proforma.discountType ? proforma.discountType.toUpperCase() : undefined,
              deposit: proforma.deposit ? Math.round(Number(proforma.deposit) * 100) : undefined,
              notes: proforma.notes,
              showSignature: proforma.showSignature,
              showStamp: proforma.showStamp,
              deliveryNoteEnabled: proforma.deliveryNoteEnabled,
              deliveryNoteTitle: proforma.deliveryNoteTitle,
              deliveryNoteContent: proforma.deliveryNoteContent,
              items: itemsForDB,
            }),
          });
          await get().fetchProformas();
        } catch (error) {
          console.error("Failed to add proforma:", error);
          throw error;
        }
      },
      updateProforma: async (id, proforma) => {
        try {
          const payload: any = {};
          if (proforma.status) payload.status = proforma.status.toUpperCase().replace(/\s+/g, '_');
          if (proforma.date) payload.date = new Date(proforma.date).toISOString();
          if (proforma.dueDate) payload.dueDate = new Date(proforma.dueDate).toISOString();
          if (proforma.taxRate !== undefined) payload.taxRate = proforma.taxRate;
          if (proforma.discount !== undefined) payload.discount = proforma.discount;
          if (proforma.discountType) payload.discountType = proforma.discountType.toUpperCase();
          if (proforma.deposit != null) payload.deposit = Math.round(Number(proforma.deposit) * 100);
          if (proforma.notes !== undefined) payload.notes = proforma.notes;
          if (proforma.showSignature !== undefined) payload.showSignature = proforma.showSignature;
          if (proforma.showStamp !== undefined) payload.showStamp = proforma.showStamp;
          if (proforma.deliveryNoteEnabled !== undefined) payload.deliveryNoteEnabled = proforma.deliveryNoteEnabled;
          if (proforma.deliveryNoteTitle !== undefined) payload.deliveryNoteTitle = proforma.deliveryNoteTitle;
          if (proforma.deliveryNoteContent !== undefined) payload.deliveryNoteContent = proforma.deliveryNoteContent;
          if (proforma.clientId) payload.clientId = proforma.clientId;
          if (proforma.client && !payload.clientId) {
            const clients = get().clients;
            const matched = clients.find((c: any) => c.company === proforma.client || c.name === proforma.client);
            if (matched) payload.clientId = matched.id;
          }
          if (proforma.amount) {
            payload.amount = Math.round(parseFloat(String(proforma.amount).replace(/[^0-9.]/g, '')) * 100);
          }
          if (proforma.items) {
            payload.items = proforma.items.map((item, index) => ({
              description: item.description,
              quantity: item.quantity,
              unitPrice: Math.round(Number(item.unitPrice) * 100),
              position: item.position !== undefined ? item.position : index,
            }));
          }
          if (proforma.id && proforma.id.startsWith('PRO-')) {
            payload.proformaNumber = proforma.id;
          }
          const allProformas = get().proformas;
          const found = allProformas.find((p: any) => p.id === id || p._dbId === id);
          const dbId = (found as any)?._dbId || id;
          const res = await apiFetch<any>(`/proformas/${dbId}`, {
            method: 'PUT',
            body: JSON.stringify(payload),
          });
          await get().fetchProformas();
          return res;
        } catch (error) {
          console.error("Failed to update proforma:", error);
          throw error;
        }
      },
      deleteProforma: async (id) => {
        try {
          const allProformas = get().proformas;
          const found = allProformas.find((p: any) => p.id === id || p._dbId === id);
          const dbId = (found as any)?._dbId || id;
          await apiFetch(`/proformas/${dbId}`, { method: 'DELETE' });
          await get().fetchProformas();
        } catch (error) {
          console.error("Failed to delete proforma:", error);
          throw error;
        }
      },

      addPackage: async (pkg) => {
        try {
          // price is a display string like "$499/mo" or "2500" — extract numeric value and convert to cents
          const priceCents = pkg.price
            ? Math.round(parseFloat(String(pkg.price).replace(/[^0-9.]/g, '')) * 100)
            : 0;
          // type: 'One-time' -> 'ONE_TIME', 'Subscription' -> 'SUBSCRIPTION', 'Service' -> 'SERVICE'
          const typeMap: Record<string, string> = { 'Service': 'SERVICE', 'Subscription': 'SUBSCRIPTION', 'One-time': 'ONE_TIME' };
          const dbType = typeMap[pkg.type] || pkg.type.toUpperCase().replace(/-/g, '_').replace(/ /g, '_');
          const featuresJson = pkg.features?.length ? JSON.stringify(pkg.features) : undefined;
          await apiFetch('/packages', {
            method: 'POST',
            body: JSON.stringify({
              name: pkg.name,
              description: pkg.description,
              price: priceCents,
              type: dbType,
              features: featuresJson,
              serviceIds: pkg.serviceIds,
              deliverables: pkg.deliverables,
            }),
          });
          await get().fetchPackages();
        } catch (error) {
          console.error("Failed to add package:", error);
          throw error;
        }
      },
      updatePackage: async (id, pkg) => {
        try {
          const payload: any = { ...pkg };
          if (payload.type) {
            const typeMap: Record<string, string> = { 'Service': 'SERVICE', 'Subscription': 'SUBSCRIPTION', 'One-time': 'ONE_TIME' };
            payload.type = typeMap[payload.type] || payload.type.toUpperCase().replace(/-/g, '_').replace(/ /g, '_');
          }
          if (payload.price !== undefined) {
            payload.price = Math.round(parseFloat(String(payload.price).replace(/[^0-9.]/g, '')) * 100);
          }
          if (payload.features !== undefined) {
            payload.features = payload.features?.length ? JSON.stringify(payload.features) : undefined;
          }
          // The backend expects deliverables if provided, which we've already defined as PackageDeliverable[]
          await apiFetch(`/packages/${id}`, {
            method: 'PUT',
            body: JSON.stringify(payload),
          });
          await get().fetchPackages();
        } catch (error) {
          console.error("Failed to update package:", error);
          throw error;
        }
      },
      deletePackage: async (id) => {
        try {
          await apiFetch(`/packages/${id}`, { method: 'DELETE' });
          await get().fetchPackages();
        } catch (error) {
          console.error("Failed to delete package:", error);
          throw error;
        }
      },

      addService: async (service) => {
        try {
          // basePrice is display string like "$100/hr" or "800" — extract numeric and convert to cents
          const basePriceCents = service.basePrice
            ? Math.round(parseFloat(String(service.basePrice).replace(/[^0-9.]/g, '')) * 100)
            : 0;
          await apiFetch('/services', {
            method: 'POST',
            body: JSON.stringify({
              name: service.name,
              category: service.category,
              basePrice: basePriceCents,
              description: service.description,
              status: service.status.toUpperCase(),
            }),
          });
          await get().fetchServices();
        } catch (error) {
          console.error("Failed to add service:", error);
          throw error;
        }
      },
      updateService: async (id, service) => {
        try {
          const payload: any = { ...service };
          if (payload.status) payload.status = payload.status.toUpperCase();
          if (payload.basePrice !== undefined) {
            payload.basePrice = Math.round(parseFloat(String(payload.basePrice).replace(/[^0-9.]/g, '')) * 100);
          }
          await apiFetch(`/services/${id}`, {
            method: 'PUT',
            body: JSON.stringify(payload),
          });
          await get().fetchServices();
        } catch (error) {
          console.error("Failed to update service:", error);
          throw error;
        }
      },
      deleteService: async (id) => {
        try {
          await apiFetch(`/services/${id}`, { method: 'DELETE' });
          await get().fetchServices();
        } catch (error) {
          console.error("Failed to delete service:", error);
          throw error;
        }
      },

      deleteLead: async (id) => {
        try {
          await apiFetch(`/leads/${id}`, { method: 'DELETE' });
          await get().fetchLeads();
        } catch (error) {
          console.error("Failed to delete lead:", error);
          throw error;
        }
      },

      updateLeadStatus: async (id, status) => {
        try {
          await apiFetch(`/leads/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ status }),
          });
          await get().fetchLeads();
        } catch (error) {
          console.error("Failed to update lead status:", error);
          throw error;
        }
      },

      fetchUsers: async () => {
        try {
          const res = await apiFetch<{ users: User[] }>('/users');
          set({ users: res.users });
        } catch (error) {
          console.error("Failed to fetch users:", error);
        }
      },

      addUser: async (user) => {
        try {
          await apiFetch('/users', {
            method: 'POST',
            body: JSON.stringify(user),
          });
          await get().fetchUsers();
        } catch (error) {
          console.error("Failed to add user:", error);
          throw error;
        }
      },

      updateUser: async (id, user) => {
        try {
          await apiFetch(`/users/${id}`, {
            method: 'PUT',
            body: JSON.stringify(user),
          });
          await get().fetchUsers();
        } catch (error) {
          console.error("Failed to update user:", error);
          throw error;
        }
      },

      deleteUser: async (id) => {
        try {
          await apiFetch(`/users/${id}`, { method: 'DELETE' });
          await get().fetchUsers();
        } catch (error) {
          console.error("Failed to delete user:", error);
          throw error;
        }
      },

      updateSettings: async (settings) => {
        try {
          // Strip frontend-only fields that don't exist in the DB schema —
          // they are only stored in the Zustand store and must not be sent to
          // PUT /settings or they'll trigger Zod "unrecognized key" errors.
          const { appVersion, versionHistory, ...dbSettings } = settings as typeof settings & { appVersion?: unknown; versionHistory?: unknown };
          await apiFetch('/settings', {
            method: 'PUT',
            body: JSON.stringify(dbSettings),
          });
          await get().fetchSettings();
        } catch (error) {
          console.error("Failed to update settings:", error);
          throw error;
        }
      },

      getVerificationToken: async (documentType, documentId) => {
        try {
          // Resolve the DB ID if we're using a display number (like INV-001)
          let dbId = documentId;
          if (documentType === 'invoice') {
            const inv = get().invoices.find(i => i.id === documentId || (i as any)._dbId === documentId);
            if (inv) dbId = (inv as any)._dbId || inv.id;
          } else if (documentType === 'proforma') {
            const prof = get().proformas.find(p => p.id === documentId || (p as any)._dbId === documentId);
            if (prof) dbId = (prof as any)._dbId || prof.id;
          } else if (documentType === 'subscription') {
            const sub = get().subscriptions.find(s => s.id === documentId);
            if (sub) dbId = sub.id;
          } else if (documentType === 'monthly_report') {
            // Document ID is already the UUID for reports in the current UI flow
            dbId = documentId;
          } else if (documentType === 'hr_document') {
            const doc = get().hrDocuments.find(d => d.id === documentId);
            if (doc) dbId = doc.id;
          }

          const res = await apiFetch<{ token: string }>('/verify', {
            method: 'POST',
            body: JSON.stringify({ documentType, documentId: dbId }),
          });
          return res.token;
        } catch (error) {
          console.error("Failed to get verification token:", error);
          return "";
        }
      },

      verifyDocument: async (token) => {
        try {
          const res = await apiFetch<{
            verified: boolean;
            type: 'invoice' | 'proforma' | 'subscription' | 'monthly_report' | 'hr_document';
            document: any;
          }>(`/verify/${token}`);
          if (res.verified && res.document) {
            const d = res.document;
            const mappedDoc: PublicVerificationDocument = {
              documentNumber: d.number,
              date: d.date,
              status: d.status
                ? d.status.split('_').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ')
                : '',
              amountFormatted: d.amount !== undefined ? formatCurrency((d.amount || 0) / 100) : undefined,
              clientMask: d.clientMask || '•••***',
              plan: d.plan,
              startDate: d.startDate,
              endDate: d.endDate,
              title: d.title,
              month: d.month,
              year: d.year,
              // HR fields
              employeeName: d.employeeName,
              employeePosition: d.employeePosition,
              dateCreated: d.dateCreated,
              docType: d.docType,
            };
            return { type: res.type, document: mappedDoc };
          }
          return null;
        } catch (error) {
          console.error("Verification failed:", error);
          return null;
        }
      },
      generatePortalAccess: async (clientId: string) => {
        try {
          const res = await apiFetch<{ tempPassword: string }>(`/clients/${clientId}/portal-access`, {
            method: 'POST'
          });
          return res;
        } catch (error) {
          console.error("Failed to generate portal access:", error);
          throw error;
        }
      },
      uploadFile: async (file: File, onProgress?: (progress: number) => void, isPrivate?: boolean) => {
        const formData = new FormData();
        formData.append('file', file);
        set({ isGlobalUploading: true, globalUploadProgress: 0 });
        try {
          const endpoint = isPrivate ? '/settings/upload?private=true' : '/settings/upload';
          const res = await apiUpload<{ url: string }>(endpoint, formData, (progress) => {
            set({ globalUploadProgress: progress });
            if (onProgress) onProgress(progress);
          });
          return res.url;
        } finally {
          // Add a small delay for a smoother UI transition after 100%
          setTimeout(() => {
            set({ isGlobalUploading: false, globalUploadProgress: 0 });
          }, 1000);
        }
      },
    }),
    {
      name: 'agency-data-sync-v2',
      // Only persist settings.
      // All entity lists and tokens are always fetched or generated via backend.
      partialize: (state) => ({
        settings: {
          ...state.settings,
          logo: state.settings.logo?.startsWith('data:') ? '' : state.settings.logo,
          whiteLogo: state.settings.whiteLogo?.startsWith('data:') ? '' : state.settings.whiteLogo,
          favicon: state.settings.favicon?.startsWith('data:') ? '' : state.settings.favicon,
        },
      }),
      merge: (persistedState: any, currentState: AgencyStore) => {
        return {
          ...currentState,
          settings: persistedState?.settings || currentState.settings,
        };
      },
    }
  )
);
