import { Router } from 'express';
import authRoutes from './auth.routes.js';
import clientsRoutes from './clients.routes.js';
import projectsRoutes from './projects.routes.js';
import teamRoutes from './team.routes.js';
import invoicesRoutes from './invoices.routes.js';
import proformasRoutes from './proformas.routes.js';
import subscriptionsRoutes from './subscriptions.routes.js';
import packagesRoutes from './packages.routes.js';
import servicesRoutes from './services.routes.js';
import settingsRoutes from './settings.routes.js';
import verifyRoutes from './verify.routes.js';
import leadsRoutes from './leads.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/clients', clientsRoutes);
router.use('/projects', projectsRoutes);
router.use('/team', teamRoutes);
router.use('/invoices', invoicesRoutes);
router.use('/proformas', proformasRoutes);
router.use('/subscriptions', subscriptionsRoutes);
router.use('/packages', packagesRoutes);
router.use('/services', servicesRoutes);
router.use('/settings', settingsRoutes);
router.use('/verify', verifyRoutes);
router.use('/leads', leadsRoutes);

export default router;
