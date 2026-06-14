import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiFetch } from './api-client';
import { formatCurrency } from './utils';

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
  status: 'Active' | 'Offline' | 'Away';
  avatar?: string;
  projects: number;
  hourlyRate?: string;
  startDate?: string;
  bio?: string;
  createdAt: string;
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface Invoice {
  id: string;
  client: string;
  clientEmail?: string;
  clientAddress?: string;
  amount: string;
  status: 'Paid' | 'Pending' | 'Overdue';
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
  createdAt: string;
}

export interface Subscription {
  id: string;
  client: string;
  clientEmail?: string;
  packageId?: string; // Link to a Package
  serviceId?: string; // Link to a Service
  plan: string; // Dynamic plan name (e.g. Package name or Service name)
  amount: string;
  billingCycle: 'Monthly' | 'Quarterly' | 'Annual';
  started: string;
  renewal: string;
  status: 'Active' | 'Paused' | 'Cancelled' | 'Trial';
  features?: string[];
  notes?: string;
  createdAt: string;
}

export interface Proforma {
  id: string;
  client: string;
  clientEmail?: string;
  amount: string;
  status: 'Draft' | 'Sent' | 'Accepted' | 'Expired';
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
  createdAt: string;
}

export interface Package {
  id: string;
  name: string;
  description: string;
  price: string;
  features: string[];
  type: 'Service' | 'Subscription' | 'One-time';
  serviceIds?: string[]; // IDs of services included in this package
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
  documentType: 'invoice' | 'proforma';
  documentId: string;
  createdAt: string;
}

export interface PaymentMethod {
  id: string;
  name: string;
  type: 'stripe' | 'paypal' | 'bank' | 'other';
  details: string;
  isActive: boolean;
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
  primaryColor: string;
  signature: string;
  stamp: string;
  taxRate: number;
  defaultInvoiceNotes: string;
  paymentMethods: PaymentMethod[];
  socialLinks: {
    facebook?: string;
    twitter?: string;
    instagram?: string;
    linkedin?: string;
  };
  notifications: {
    emailAlerts: boolean;
    projectUpdates: boolean;
    billingAlerts: boolean;
  };
  enableRecaptcha?: boolean;
  recaptchaSiteKey?: string;
  recaptchaSecretKey?: string;
  openAiApiKey?: string;
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

  addClient: (client: Omit<Client, 'id' | 'createdAt'>) => Promise<Client>;
  updateClient: (id: string, client: Partial<Client>) => Promise<void>;
  deleteClient: (id: string) => Promise<void>;

  addProject: (project: Omit<Project, 'id'>) => Promise<void>;
  updateProject: (id: string, project: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;

  addTeamMember: (member: Omit<TeamMember, 'id'>) => Promise<void>;
  updateTeamMember: (id: string, member: Partial<TeamMember>) => Promise<void>;
  deleteTeamMember: (id: string) => Promise<void>;

  addInvoice: (invoice: Omit<Invoice, 'id'> & { id?: string }) => Promise<void>;
  updateInvoice: (id: string, invoice: Partial<Invoice>) => Promise<void>;
  deleteInvoice: (id: string) => Promise<void>;

  addSubscription: (subscription: Omit<Subscription, 'id'>) => Promise<void>;
  updateSubscription: (id: string, subscription: Partial<Subscription>) => Promise<void>;
  deleteSubscription: (id: string) => Promise<void>;

  addProforma: (proforma: Omit<Proforma, 'id'> & { id?: string }) => Promise<void>;
  updateProforma: (id: string, proforma: Partial<Proforma>) => Promise<void>;
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
  getVerificationToken: (documentType: 'invoice' | 'proforma', documentId: string) => Promise<string>;
  verifyDocument: (token: string) => Promise<{ type: 'invoice' | 'proforma'; document: Invoice | Proforma } | null>;
  
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
  fetchAllData: () => Promise<void>;
  generatePortalAccess: (clientId: string) => Promise<{ accessCode: string }>;
  uploadFile: (file: File) => Promise<string>;
}

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
      settings: {
        agencyName: "Hirdan Marketing Management",
        adminEmail: "contact@hirdanmarketing.com",
        phone: "+1 555-0101",
        website: "https://hirdanmarketing.com",
        address: "123 Tech Ave, San Francisco, CA 94105",
        currency: "DJF",
        timezone: "Africa/Djibouti",
        logo: "https://placehold.co/200x60/504188/white?text=LOGO",
        whiteLogo: "https://placehold.co/200x60/white/504188?text=LOGO",
        favicon: "https://placehold.co/32x32/504188/white?text=H",
        primaryColor: "#504188",
        signature: "",
        stamp: "",
        taxRate: 15,
        defaultInvoiceNotes: "Thank you for your business! Please make payment within 14 days.",
        paymentMethods: [
          { id: '1', name: "Bank Transfer", type: 'bank', details: 'IBAN: GB1234567890\nSWIFT: BANKGB22', isActive: true },
          { id: '2', name: "Stripe", type: 'stripe', details: 'Connected', isActive: true },
          { id: '3', name: "PayPal", type: 'paypal', details: 'payments@hirdan.com', isActive: true },
          { id: '4', name: "Cash", type: 'other', details: 'In-person payments only', isActive: true }
        ],
        socialLinks: {
          linkedin: "https://linkedin.com/company/hirdan",
          twitter: "https://twitter.com/hirdan",
        },
        notifications: {
          emailAlerts: true,
          projectUpdates: true,
          billingAlerts: true,
        },
        enableRecaptcha: false,
        recaptchaSiteKey: "",
        recaptchaSecretKey: "",
        openAiApiKey: "",
      },

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
            revenue: '$0',
            initials: c.initials || (c.company ? c.company.substring(0, 2).toUpperCase() : c.name.substring(0, 2).toUpperCase()),
            createdAt: c.createdAt,
            userId: c.userId
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
            status: i.status.charAt(0).toUpperCase() + i.status.slice(1).toLowerCase() as any,
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
            plan: s.package?.name || s.plan || 'Custom',
            amount: formatCurrency((s.amount || 0) / 100),
            billingCycle: s.billingCycle.charAt(0).toUpperCase() + s.billingCycle.slice(1).toLowerCase() as any,
            started: s.started ? s.started.split('T')[0] : '',
            renewal: s.renewal ? s.renewal.split('T')[0] : 'N/A',
            status: s.status.charAt(0).toUpperCase() + s.status.slice(1).toLowerCase() as any,
            features: s.features ? (typeof s.features === 'string' ? JSON.parse(s.features) : s.features) : [],
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
            status: p.status.charAt(0).toUpperCase() + p.status.slice(1).toLowerCase() as any,
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
              features: p.features ? (typeof p.features === 'string' ? JSON.parse(p.features) : p.features) : [],
              type: typeDisplay,
              serviceIds: (p.packageServices || []).map((ps: any) => ps.serviceId || ps.service?.id).filter(Boolean),
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
          const mapped = res.team.map(m => ({
            id: m.id,
            name: m.name,
            email: m.email,
            phone: m.phone || '',
            role: m.role || 'Member',
            department: m.department,
            status: m.status.charAt(0).toUpperCase() + m.status.slice(1).toLowerCase() as any,
            projects: m._count?.projects || 0,
            hourlyRate: m.hourlyRate ? formatCurrency(m.hourlyRate / 100) : '',
            startDate: m.startDate ? m.startDate.split('T')[0] : m.createdAt.split('T')[0],
            bio: m.bio,
            createdAt: m.createdAt
          }));
          set({ team: mapped });
        } catch (error) {
          console.error("Failed to fetch team:", error);
        }
      },

      fetchSettings: async () => {
        try {
          const res = await apiFetch<{ settings: any }>('/settings');
          if (res.settings) {
            const settings = res.settings;
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
            set({ settings: { ...get().settings, ...settings } });
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
          get().fetchSettings()
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
            revenue: '$0',
            initials: c.initials || (c.company ? c.company.substring(0, 2).toUpperCase() : c.name.substring(0, 2).toUpperCase()),
            createdAt: c.createdAt,
            userId: c.userId
          } as Client;
        } catch (error) {
          console.error("Failed to add client:", error);
          throw error;
        }
      },

      updateClient: async (id, client) => {
        try {
          const { revenue, projects, ...clientData } = client as any;
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
          // Convert hourlyRate string (e.g. "85" or "$85") to cents Int
          const hourlyRateCents = member.hourlyRate
            ? Math.round(parseFloat(String(member.hourlyRate).replace(/[^0-9.]/g, '')) * 100)
            : undefined;
          const { projects, ...memberData } = member as any;
          await apiFetch('/team', {
            method: 'POST',
            body: JSON.stringify({
              ...memberData,
              hourlyRate: hourlyRateCents,
              status: member.status.toUpperCase(),
              startDate: member.startDate ? new Date(member.startDate).toISOString() : undefined,
            }),
          });
          await get().fetchTeam();
        } catch (error) {
          console.error("Failed to add team member:", error);
          throw error;
        }
      },
      updateTeamMember: async (id, member) => {
        try {
          const { projects, ...memberData } = member as any;
          const payload: any = { ...memberData };
          if (payload.status) payload.status = payload.status.toUpperCase();
          if (payload.startDate) payload.startDate = new Date(payload.startDate).toISOString();
          if (payload.hourlyRate !== undefined) {
            payload.hourlyRate = payload.hourlyRate
              ? Math.round(parseFloat(String(payload.hourlyRate).replace(/[^0-9.]/g, '')) * 100)
              : undefined;
          }
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
          const amountCents = invoice.amount
            ? Math.round(parseFloat(String(invoice.amount).replace(/[^0-9.]/g, '')) * 100)
            : 0;
          const depositCents = invoice.deposit != null
            ? Math.round(Number(invoice.deposit) * 100)
            : undefined;
          // items unitPrice -> cents
          const itemsForDB = (invoice.items || []).map(item => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: Math.round(Number(item.unitPrice) * 100),
          }));
          await apiFetch('/invoices', {
            method: 'POST',
            body: JSON.stringify({
              invoiceNumber: (invoice as any).id || invoice.id,
              clientId,
              amount: amountCents,
              status: invoice.status.toUpperCase(),
              date: invoice.date ? new Date(invoice.date).toISOString() : new Date().toISOString(),
              dueDate: invoice.dueDate ? new Date(invoice.dueDate).toISOString() : undefined,
              taxRate: invoice.taxRate,
              discount: invoice.discount,
              discountType: invoice.discountType ? invoice.discountType.toUpperCase() : undefined,
              deposit: depositCents,
              paymentMethod: invoice.paymentMethod,
              notes: invoice.notes,
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
          if (invoice.status) payload.status = invoice.status.toUpperCase();
          if (invoice.date) payload.date = new Date(invoice.date).toISOString();
          if (invoice.dueDate) payload.dueDate = new Date(invoice.dueDate).toISOString();
          if (invoice.taxRate !== undefined) payload.taxRate = invoice.taxRate;
          if (invoice.discount !== undefined) payload.discount = invoice.discount;
          if (invoice.discountType) payload.discountType = invoice.discountType.toUpperCase();
          if (invoice.paymentMethod) payload.paymentMethod = invoice.paymentMethod;
          if (invoice.notes !== undefined) payload.notes = invoice.notes;
          if (invoice.deposit != null) payload.deposit = Math.round(Number(invoice.deposit) * 100);
          if (invoice.client) {
            const clients = get().clients;
            const matched = clients.find((c: any) => c.company === invoice.client || c.name === invoice.client);
            if (matched) payload.clientId = matched.id;
          }
          if (invoice.amount) {
            payload.amount = Math.round(parseFloat(String(invoice.amount).replace(/[^0-9.]/g, '')) * 100);
          }
          if (invoice.items) {
            payload.items = invoice.items.map(item => ({
              description: item.description,
              quantity: item.quantity,
              unitPrice: Math.round(Number(item.unitPrice) * 100),
            }));
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
          const featuresJson = subscription.features?.length
            ? JSON.stringify(subscription.features)
            : undefined;
          await apiFetch('/subscriptions', {
            method: 'POST',
            body: JSON.stringify({
              clientId: matched.id,
              packageId: subscription.packageId || undefined,
              plan: subscription.plan,
              amount: amountCents,
              billingCycle: subscription.billingCycle.toUpperCase(),
              started: subscription.started ? new Date(subscription.started).toISOString() : new Date().toISOString(),
              renewal: subscription.renewal && subscription.renewal !== 'N/A' ? new Date(subscription.renewal).toISOString() : undefined,
              status: subscription.status.toUpperCase(),
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
          if (subscription.status) payload.status = subscription.status.toUpperCase();
          if (subscription.billingCycle) payload.billingCycle = subscription.billingCycle.toUpperCase();
          if (subscription.plan) payload.plan = subscription.plan;
          if (subscription.amount !== undefined) {
            payload.amount = Math.round(parseFloat(String(subscription.amount).replace(/[^0-9.]/g, '')) * 100);
          }
          if (subscription.started) payload.started = new Date(subscription.started).toISOString();
          if (subscription.renewal) {
            payload.renewal = subscription.renewal !== 'N/A' ? new Date(subscription.renewal).toISOString() : undefined;
          }
          if (subscription.features !== undefined) {
            payload.features = subscription.features?.length ? JSON.stringify(subscription.features) : undefined;
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
          const itemsForDB = (proforma.items || []).map(item => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: Math.round(Number(item.unitPrice) * 100),
          }));
          await apiFetch('/proformas', {
            method: 'POST',
            body: JSON.stringify({
              proformaNumber: (proforma as any).id || proforma.id,
              clientId: matched.id,
              amount: amountCents,
              status: proforma.status.toUpperCase(),
              date: proforma.date ? new Date(proforma.date).toISOString() : new Date().toISOString(),
              dueDate: proforma.dueDate ? new Date(proforma.dueDate).toISOString() : undefined,
              taxRate: proforma.taxRate,
              discount: proforma.discount,
              discountType: proforma.discountType ? proforma.discountType.toUpperCase() : undefined,
              deposit: proforma.deposit ? Math.round(Number(proforma.deposit) * 100) : undefined,
              notes: proforma.notes,
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
          if (proforma.status) payload.status = proforma.status.toUpperCase();
          if (proforma.date) payload.date = new Date(proforma.date).toISOString();
          if (proforma.dueDate) payload.dueDate = new Date(proforma.dueDate).toISOString();
          if (proforma.taxRate !== undefined) payload.taxRate = proforma.taxRate;
          if (proforma.discount !== undefined) payload.discount = proforma.discount;
          if (proforma.discountType) payload.discountType = proforma.discountType.toUpperCase();
          if (proforma.deposit != null) payload.deposit = Math.round(Number(proforma.deposit) * 100);
          if (proforma.notes !== undefined) payload.notes = proforma.notes;
          if (proforma.client) {
            const clients = get().clients;
            const matched = clients.find((c: any) => c.company === proforma.client || c.name === proforma.client);
            if (matched) payload.clientId = matched.id;
          }
          if (proforma.amount) {
            payload.amount = Math.round(parseFloat(String(proforma.amount).replace(/[^0-9.]/g, '')) * 100);
          }
          if (proforma.items) {
            payload.items = proforma.items.map(item => ({
              description: item.description,
              quantity: item.quantity,
              unitPrice: Math.round(Number(item.unitPrice) * 100),
            }));
          }
          const allProformas = get().proformas;
          const found = allProformas.find((p: any) => p.id === id || p._dbId === id);
          const dbId = (found as any)?._dbId || id;
          await apiFetch(`/proformas/${dbId}`, {
            method: 'PUT',
            body: JSON.stringify(payload),
          });
          await get().fetchProformas();
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
          delete payload.serviceIds;
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
          await apiFetch('/settings', {
            method: 'PUT',
            body: JSON.stringify(settings),
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
          } else {
            const prof = get().proformas.find(p => p.id === documentId || (p as any)._dbId === documentId);
            if (prof) dbId = (prof as any)._dbId || prof.id;
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
          const res = await apiFetch<{ verified: boolean; type: 'invoice' | 'proforma'; document: any }>(`/verify/${token}`);
          if (res.verified && res.document) {
            const d = res.document;
            const mappedDoc = {
              ...d,
              id: d.invoiceNumber || d.proformaNumber || d.id,
              status: d.status.charAt(0).toUpperCase() + d.status.slice(1).toLowerCase(),
              amount: formatCurrency((d.amount || 0) / 100),
              // Map client name/company if nested
              client: (d.client && typeof d.client === 'object') ? (d.client.company || d.client.name) : d.client,
              items: (d.items || []).map((item: any) => ({
                ...item,
                unitPrice: item.unitPrice / 100 // convert cents to readable for formatCurrency to re-convert later? Wait, the UI uses formatCurrency(total)
                // Actually the UI in VerifyDocumentPage uses formatCurrency directly on the raw unitPrice it gets from the store.
                // fetchInvoices maps (i.amount)/100 but items are raw in fetchInvoices too?
              }))
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
          const res = await apiFetch<{ accessCode: string }>(`/clients/${clientId}/portal-access`, {
            method: 'POST'
          });
          return res;
        } catch (error) {
          console.error("Failed to generate portal access:", error);
          throw error;
        }
      },
      uploadFile: async (file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        const res = await apiFetch<{ url: string }>('/settings/upload', {
          method: 'POST',
          body: formData,
          headers: { 'Content-Type': 'SKIP' as any }
        });
        return res.url;
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
