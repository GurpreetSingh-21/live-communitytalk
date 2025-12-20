const { PrismaClient } = require('@prisma/client');

// Prevent multiple instances in dev (hot reload)
const globalForPrisma = global;

const prisma = globalForPrisma.prisma || new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

// Log slow queries
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
