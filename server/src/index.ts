import { env } from './config/env.js';
import app from './app.js';
import { prisma } from './lib/prisma.js';
import { closePdfBrowser } from './lib/pdf/puppeteer-browser.js';

// ─── Load email credentials from DB into process.env ─────────────
// Runs once after boot so that the sendEmail() utility works immediately
// even when keys are stored in the database rather than the .env file.

async function syncEmailEnvFromDb() {
  try {
    const settings = await prisma.agencySettings.findFirst({
      select: {
        resendApiKey: true,
        emailFrom: true,
        mailerName: true,
        resendWebhookSecret: true,
        resendInboundDomain: true,
      },
    });

    if (settings?.resendApiKey) {
      const dbKey = settings.resendApiKey.trim();
      const isDbKeyValid = dbKey && dbKey.startsWith('re_') && !dbKey.includes('xxx');
      const isEnvPlaceholder =
        !process.env.RESEND_API_KEY ||
        process.env.RESEND_API_KEY.includes('xxx') ||
        process.env.RESEND_API_KEY.trim() === '';

      if (isDbKeyValid && (isEnvPlaceholder || process.env.RESEND_API_KEY !== dbKey)) {
        process.env.RESEND_API_KEY = dbKey;
        console.log('📧 RESEND_API_KEY loaded/synchronized from database');
      }
    }

    if (settings?.emailFrom) {
      const dbEmail = settings.emailFrom.trim();
      const isDbEmailValid = dbEmail && dbEmail.includes('@') && !dbEmail.includes('yourdomain.com');
      const isEnvPlaceholder =
        !process.env.EMAIL_FROM ||
        process.env.EMAIL_FROM.includes('yourdomain.com') ||
        process.env.EMAIL_FROM.trim() === '';

      if (isDbEmailValid && (isEnvPlaceholder || process.env.EMAIL_FROM !== dbEmail)) {
        process.env.EMAIL_FROM = dbEmail;
      }
    }

    if (settings?.mailerName && !process.env.MAILER_NAME) {
      process.env.MAILER_NAME = settings.mailerName.trim();
    }

    // Required for Email Center inbound + delivery tracking webhooks.
    if (settings?.resendWebhookSecret) {
      const secret = settings.resendWebhookSecret.trim();
      if (secret.startsWith('whsec_') && !process.env.RESEND_WEBHOOK_SECRET) {
        process.env.RESEND_WEBHOOK_SECRET = secret;
        console.log('📧 RESEND_WEBHOOK_SECRET loaded from database');
      }
    }

    if (settings?.resendInboundDomain && !process.env.RESEND_INBOUND_DOMAIN) {
      process.env.RESEND_INBOUND_DOMAIN = settings.resendInboundDomain.trim();
    }

    if (!process.env.RESEND_API_KEY) {
      console.warn('⚠️  Email send: RESEND_API_KEY not configured (env or Settings → Email)');
    }
    if (!process.env.RESEND_WEBHOOK_SECRET) {
      console.warn(
        '⚠️  Email receive: RESEND_WEBHOOK_SECRET not configured — inbound webhooks will be rejected'
      );
    }
  } catch (error) {
    // Non-fatal — email just won't work until configured via settings panel
    console.warn('⚠️  Could not load email settings from database on startup:', error);
  }
}

const server = app.listen(env.PORT, async () => {
  console.log(`\n🚀 Server running on port ${env.PORT}`);
  console.log(`📍 Health check: http://localhost:${env.PORT}/api/health`);
  console.log(`🔧 Environment: ${env.NODE_ENV}\n`);

  await syncEmailEnvFromDb();
});

// ─── Graceful Shutdown ────────────────────────────────────────────

async function shutdown(signal: string) {
  console.log(`\n${signal} received. Shutting down gracefully...`);

  server.close(async () => {
    await closePdfBrowser();
    await prisma.$disconnect();
    console.log('✅ Server shut down cleanly');
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('❌ Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  console.error('💥 Unhandled Rejection:', reason);
  shutdown('unhandledRejection');
});
