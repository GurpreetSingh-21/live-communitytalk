const { PrismaClient } = require('@prisma/client');

// Prevent multiple instances in dev (hot reload)
const globalForPrisma = global;

// ── pgBouncer compatibility ───────────────────────────────────────────────
// Supabase uses pgBouncer in transaction mode. Prisma uses prepared statements
// by default, which breaks with pgBouncer because connections are recycled
// between requests. Adding ?pgbouncer=true forces Prisma to use the simple
// query protocol (no prepared statements).
// We enforce this in code so it works regardless of .env formatting on EC2.
function getPgBouncerUrl() {
    const url = process.env.DATABASE_URL || '';
    if (!url) return url;
    // Idempotent: only add if not already present
    if (url.includes('pgbouncer=true')) return url;
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}pgbouncer=true`;
}

const prisma = globalForPrisma.prisma || new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    datasources: {
        db: { url: getPgBouncerUrl() },
    },
});

// Log slow queries (>100ms)
prisma.$use(async (params, next) => {
    const before = Date.now();
    const result = await next(params);
    const after = Date.now();
    if (after - before > 100) {
        console.log(`[PRISMA SLOW] ${params.model}.${params.action} took ${after - before}ms`);
    }
    return result;
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

module.exports = prisma;

