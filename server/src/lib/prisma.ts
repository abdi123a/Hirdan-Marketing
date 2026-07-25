import { PrismaClient } from '@prisma/client';
// Imported before ./settings-secrets.js so dotenv has populated process.env
// (notably TOKEN_ENCRYPTION_KEY) before any crypto helper is reached.
import { env } from '../config/env.js';
import { encryptSecrets, decryptSecrets } from './settings-secrets.js';

const globalForPrisma = globalThis as unknown as {
  prisma: ExtendedPrismaClient | undefined;
};

const READ_OPERATIONS = new Set([
  'findFirst',
  'findFirstOrThrow',
  'findUnique',
  'findUniqueOrThrow',
  'findMany',
]);

const WRITE_OPERATIONS = new Set(['create', 'update', 'upsert', 'createMany', 'updateMany']);

function createPrismaClient() {
  const base = new PrismaClient({
    log: env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

  // Transparent encryption at rest for AgencySettings credential columns.
  //
  // Doing this here rather than at each call site means every existing
  // `prisma.agencySettings.*` call keeps working untouched, and there is exactly
  // one place where a secret can accidentally be written in the clear. See
  // ./settings-secrets.ts for which columns are covered and how the versioned
  // ciphertext prefix keeps this idempotent and backwards compatible.
  return base.$extends({
    name: 'agencySettingsSecrets',
    query: {
      agencySettings: {
        async $allOperations({ operation, args, query }) {
          if (WRITE_OPERATIONS.has(operation)) {
            const a = args as Record<string, any>;
            if (a?.data) {
              a.data = Array.isArray(a.data)
                ? a.data.map((d: Record<string, unknown>) => encryptSecrets(d))
                : encryptSecrets(a.data);
            }
            // upsert carries both branches
            if (a?.create) a.create = encryptSecrets(a.create);
            if (a?.update) a.update = encryptSecrets(a.update);
          }

          const result = await query(args);

          if (READ_OPERATIONS.has(operation) || WRITE_OPERATIONS.has(operation)) {
            if (Array.isArray(result)) return result.map((row) => decryptSecrets(row));
            return decryptSecrets(result);
          }
          return result;
        },
      },
    },
  });
}

type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>;

export const prisma: ExtendedPrismaClient = globalForPrisma.prisma ?? createPrismaClient();

if (env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
