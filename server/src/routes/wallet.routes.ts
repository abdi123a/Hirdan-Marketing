import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { buildPass, safeEqual, walletAuthToken } from '../lib/wallet-pass.js';

// Apple Wallet web service (https://developer.apple.com/documentation/walletpasses/adding-a-web-service-to-update-passes).
// iPhones register here after adding a business-card pass; when the card changes we push via APNs
// (lib/wallet-pass.ts) and the phone fetches the new pass from GET /v1/passes/... below.

const router = Router();

const passTypeOk = (req: Request) => req.params.passTypeId === env.WALLET_PASS_TYPE_ID;
const authOk = (req: Request, serial: string) =>
  safeEqual((req.header('authorization') || '').replace(/^ApplePass\s+/i, ''), walletAuthToken(serial));

// Register a device for a pass
router.post('/v1/devices/:deviceId/registrations/:passTypeId/:serial', async (req: Request, res: Response, next) => {
  try {
    const { deviceId, serial } = req.params as Record<string, string>;
    if (!passTypeOk(req) || !authOk(req, serial)) return res.sendStatus(401);
    const pushToken = typeof req.body?.pushToken === 'string' ? req.body.pushToken.slice(0, 190) : '';
    if (!pushToken) return res.sendStatus(400);
    const card = await prisma.businessCard.findUnique({ where: { id: serial }, select: { id: true } });
    if (!card) return res.sendStatus(401);
    const existing = await prisma.walletRegistration.findUnique({ where: { deviceId_cardId: { deviceId, cardId: serial } } });
    await prisma.walletRegistration.upsert({
      where: { deviceId_cardId: { deviceId, cardId: serial } },
      update: { pushToken },
      create: { deviceId: deviceId.slice(0, 190), pushToken, cardId: serial },
    });
    return res.sendStatus(existing ? 200 : 201);
  } catch (error) {
    return next(error);
  }
});

// Unregister
router.delete('/v1/devices/:deviceId/registrations/:passTypeId/:serial', async (req: Request, res: Response, next) => {
  try {
    const { deviceId, serial } = req.params as Record<string, string>;
    if (!passTypeOk(req) || !authOk(req, serial)) return res.sendStatus(401);
    await prisma.walletRegistration.deleteMany({ where: { deviceId, cardId: serial } });
    return res.sendStatus(200);
  } catch (error) {
    return next(error);
  }
});

// Which of this device's passes changed since `passesUpdatedSince`
router.get('/v1/devices/:deviceId/registrations/:passTypeId', async (req: Request, res: Response, next) => {
  try {
    if (!passTypeOk(req)) return res.sendStatus(404);
    const since = Number(req.query.passesUpdatedSince) || 0;
    const regs = await prisma.walletRegistration.findMany({
      where: { deviceId: req.params.deviceId as string },
      select: { card: { select: { id: true, updatedAt: true } } },
    });
    const changed = regs.map((r) => r.card).filter((c) => c.updatedAt.getTime() > since);
    if (changed.length === 0) return res.sendStatus(204);
    const lastUpdated = String(Math.max(...changed.map((c) => c.updatedAt.getTime())));
    return res.json({ serialNumbers: changed.map((c) => c.id), lastUpdated });
  } catch (error) {
    return next(error);
  }
});

// Latest version of a pass
router.get('/v1/passes/:passTypeId/:serial', async (req: Request, res: Response, next) => {
  try {
    const serial = req.params.serial as string;
    if (!passTypeOk(req) || !authOk(req, serial)) return res.sendStatus(401);
    const card = await prisma.businessCard.findUnique({ where: { id: serial } });
    if (!card || !card.enabled) return res.sendStatus(401);
    const since = req.header('if-modified-since');
    if (since && card.updatedAt.getTime() <= new Date(since).getTime() + 999) return res.sendStatus(304);
    res.setHeader('Content-Type', 'application/vnd.apple.pkpass');
    res.setHeader('Last-Modified', card.updatedAt.toUTCString());
    return res.send(await buildPass(card));
  } catch (error) {
    return next(error);
  }
});

// Wallet error log
router.post('/v1/log', (req: Request, res: Response) => {
  const logs = Array.isArray(req.body?.logs) ? req.body.logs.slice(0, 20) : [];
  logs.forEach((l: unknown) => console.warn('[wallet]', String(l).slice(0, 500)));
  res.sendStatus(200);
});

export default router;
