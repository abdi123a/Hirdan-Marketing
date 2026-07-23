import { Router } from 'express';
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

// Social Media Module
import socialProfilesRoutes from './social-profiles.routes.js';
import clientDocumentsRoutes from './client-documents.routes.js';
import packageDeliverablesRoutes from './package-deliverables.routes.js';
import tasksRoutes from './tasks.routes.js';
import portalSocialRoutes from './portal-social.routes.js';
import fileRoutes from './files.routes.js';
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
router.use('/hr/documents', hrRoutes);
router.use('/clients', clientsRoutes);
router.use('/projects', projectsRoutes);
router.use('/team', teamRoutes);
router.use('/team', employeeFilesRoutes);
router.use('/team', employeeActivityRoutes);
router.use('/invoices', invoicesRoutes);
router.use('/proformas', proformasRoutes);
router.use('/subscriptions', subscriptionsRoutes);
router.use('/packages', packagesRoutes);
router.use('/services', servicesRoutes);
router.use('/settings', settingsRoutes);
router.use('/verify', verifyRoutes);
router.use('/leads', leadsRoutes);
router.use('/users', usersRoutes);
router.use('/ai', aiRoutes);
router.use('/financial', financialRoutes);
router.use('/accounts', accountsRoutes);
router.use('/expenses', expensesRoutes);
router.use('/recurring-expenses', recurringExpensesRoutes);
router.use('/notifications', notificationsRoutes);

// Social Media Module — nested under existing resource paths
router.use('/clients', socialProfilesRoutes);
router.use('/clients', clientDocumentsRoutes);
router.use('/clients', contentPostsRoutes);
router.use('/clients', meetingsRoutes);
router.use('/packages', packageDeliverablesRoutes);
router.use('/tasks', tasksRoutes);
router.use('/portal/social', portalSocialRoutes);
router.use('/reports', reportsRoutes);
// router.use('/files', fileRoutes); // Moved to /uploads in app.ts

router.use('/transfer', transferRoutes);
router.use('/landing-page', landingPageRoutes);

// New Social Media Engine routes
import socialOAuthRoutes from './social-oauth.routes.js';
import socialPostsRoutes from './social-posts.routes.js';
import socialAnalyticsRoutes from './social-analytics.routes.js';
import socialImportRoutes from './social-import.routes.js';

router.use('/social', socialOAuthRoutes);
router.use('/social', socialPostsRoutes);
router.use('/social', socialAnalyticsRoutes);
router.use('/social', socialImportRoutes);

export default router;

