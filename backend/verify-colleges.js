const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

(async () => {
    try {
        const count = await prisma.college.count();
        console.log(`Using Prisma, found ${count} colleges.`);
        const colleges = await prisma.college.findMany({
            select: { name: true, key: true, community: { select: { tags: true } } }
        });
        if (colleges.length > 0) {
            console.log("Sample College:", colleges[0]);
        }
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
})();
