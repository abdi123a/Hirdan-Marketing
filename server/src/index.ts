import { env } from './config/env.js';
import app from './app.js';
import { prisma } from './lib/prisma.js';

const server = app.listen(env.PORT, () => {
  console.log(`\n🚀 Server running on port ${env.PORT}`);
  console.log(`📍 Health check: http://localhost:${env.PORT}/api/health`);
  console.log(`🔧 Environment: ${env.NODE_ENV}\n`);
});

// ─── Graceful Shutdown ────────────────────────────────────────────

async function shutdown(signal: string) {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  
  server.close(async () => {
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
