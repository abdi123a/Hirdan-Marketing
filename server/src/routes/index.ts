import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireModuleAccess } from '../lib/permission-guard.js';
import authRoutes from './auth.routes.js';
import clientsRoutes from './clients.routes.js';
import projectsRoutes from './projects.routes.js';
import teamRoutes from './team.routes.js';
import employeeFilesRoutes from './employee-files.routes.js';
import employeeActivityRoutes from './employee-activity.routes.js';
import invoicesRoutes from './invoices.routes.js';
import proformasRoutes from './proformas.routes.js';
import subscriptionsRoutes from './subscriptions.routes.js';
import packagesRoutes from './packages.routes.js';
import servicesRoutes from './services.routes.js';
import settingsRoutes from './settings.routes.js';
import verifyRoutes from './verify.routes.js';
import leadsRoutes from './leads.routes.js';
import usersRoutes from './users.routes.js';
import aiRoutes from './ai.routes.js';
import transferRoutes from './transfer.routes.js';
import notificationsRoutes from './notifications.routes.js';
import devicesRoutes from './devices.routes.js';

// Social Media Module
import socialProfilesRoutes from './social-profiles.routes.js';
import clientDocumentsRoutes from './client-documents.routes.js';
import packageDeliverablesRoutes from './package-deliverables.routes.js';
import tasksRoutes from './tasks.routes.js';
import portalSocialRoutes from './portal-social.routes.js';
import contentPostsRoutes from './content-posts.routes.js';
import reportsRoutes from './reports.routes.js';
import financialRoutes from './financial.routes.js';
import accountsRoutes from './accounts.routes.js';
import expensesRoutes from './expenses.routes.js';
import recurringExpensesRoutes from './recurring-expenses.routes.js';
import hrRoutes from './hr.routes.js';
import landingPageRoutes from './landing-page.routes.js';
import meetingsRoutes from './meetings.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/hr/documents', authenticate, requireModuleAccess('hr'), hrRoutes);
router.use('/clients', authenticate, requireModuleAccess('clients'), clientsRoutes);
router.use('/projects', authenticate, requireModuleAccess('projects'), projectsRoutes);
router.use('/team', authenticate, requireModuleAccess('team'), teamRoutes);
router.use('/team', authenticate, requireModuleAccess('team'), employeeFilesRoutes);
router.use('/team', authenticate, requireModuleAccess('team'), employeeActivityRoutes);
router.use('/invoices', authenticate, requireModuleAccess('invoices'), invoicesRoutes);
router.use('/proformas', authenticate, requireModuleAccess('proforma'), proformasRoutes);
router.use('/subscriptions', authenticate, requireModuleAccess('subscriptions'), subscriptionsRoutes);
router.use('/packages', authenticate, requireModuleAccess('packages'), packagesRoutes);
router.use('/services', authenticate, requireModuleAccess('services'), servicesRoutes);
// Settings has public branding endpoints — auth is enforced inside the route file
router.use('/settings', settingsRoutes);
router.use('/verify', verifyRoutes);
router.use('/leads', authenticate, requireModuleAccess('leads'), leadsRoutes);
router.use('/users', usersRoutes);
router.use('/ai', authenticate, requireModuleAccess('ai_assistant'), aiRoutes);
router.use('/financial', authenticate, requireModuleAccess('financial_reports'), financialRoutes);
router.use('/accounts', authenticate, requireModuleAccess('settings'), accountsRoutes);
router.use('/expenses', authenticate, requireModuleAccess('expenses'), expensesRoutes);
router.use('/recurring-expenses', authenticate, requireModuleAccess('expenses'), recurringExpensesRoutes);
router.use('/notifications', notificationsRoutes);
router.use('/devices', devicesRoutes);

// Social Media Module — nested under existing resource paths
router.use('/clients', authenticate, requireModuleAccess('clients'), socialProfilesRoutes);
router.use('/clients', authenticate, requireModuleAccess('clients'), clientDocumentsRoutes);
router.use('/clients', authenticate, requireModuleAccess('clients'), contentPostsRoutes);
router.use('/clients', authenticate, requireModuleAccess('clients'), meetingsRoutes);
router.use('/packages', authenticate, requireModuleAccess('packages'), packageDeliverablesRoutes);
router.use('/tasks', authenticate, requireModuleAccess('projects'), tasksRoutes);
router.use('/portal/social', portalSocialRoutes);
router.use('/reports', authenticate, requireModuleAccess('monthly_reports'), reportsRoutes);

router.use('/transfer', transferRoutes);
// Landing page GET /content is public for the marketing site — auth is per-route
router.use('/landing-page', landingPageRoutes);

// New Social Media Engine routes
import socialOAuthRoutes from './social-oauth.routes.js';
import socialPostsRoutes from './social-posts.routes.js';
import socialAnalyticsRoutes from './social-analytics.routes.js';
import socialImportRoutes from './social-import.routes.js';

// OAuth callback is public (provider redirect) — auth is enforced per-route inside
router.use('/social', socialOAuthRoutes);
router.use('/social', authenticate, requireModuleAccess('social_media'), socialPostsRoutes);
router.use('/social', authenticate, requireModuleAccess('social_media'), socialAnalyticsRoutes);
router.use('/social', authenticate, requireModuleAccess('social_media'), socialImportRoutes);

// Email Center
import emailMailboxesRoutes from './email-mailboxes.routes.js';
import emailMessagesRoutes from './email-messages.routes.js';
import emailConversationsRoutes from './email-conversations.routes.js';
import emailStreamRoutes from './email-stream.routes.js';
import emailTrackingRoutes from './email-tracking.routes.js';
import emailTemplatesRoutes from './email-templates.routes.js';
import emailLabelsRoutes from './email-labels.routes.js';
import emailNotesRoutes from './email-notes.routes.js';
import emailOutboxRoutes from './email-outbox.routes.js';
import emailAnalyticsRoutes from './email-analytics.routes.js';
import emailCustomersRoutes from './email-customers.routes.js';
import emailAttachmentsRoutes from './email-attachments.routes.js';

router.use('/email', authenticate, requireModuleAccess('email'), emailStreamRoutes);
router.use('/email', authenticate, requireModuleAccess('email'), emailMailboxesRoutes);
router.use('/email', authenticate, requireModuleAccess('email'), emailMessagesRoutes);
router.use('/email', authenticate, requireModuleAccess('email'), emailConversationsRoutes);
// Tracking has a public open-pixel — auth is handled inside the route file
router.use('/email', emailTrackingRoutes);
router.use('/email', authenticate, requireModuleAccess('email'), emailTemplatesRoutes);
router.use('/email', authenticate, requireModuleAccess('email'), emailLabelsRoutes);
router.use('/email', authenticate, requireModuleAccess('email'), emailNotesRoutes);
router.use('/email', authenticate, requireModuleAccess('email'), emailOutboxRoutes);
router.use('/email', authenticate, requireModuleAccess('email'), emailAnalyticsRoutes);
router.use('/email', authenticate, requireModuleAccess('email'), emailCustomersRoutes);
router.use('/email', authenticate, requireModuleAccess('email'), emailAttachmentsRoutes);

export default router;
