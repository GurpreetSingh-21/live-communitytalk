const { PrismaClient } = require('@prisma/client');

async function main() {
  const directUrl = "postgresql://postgres.jmrhdeyhjiqxkyfjymmt:Debugdragons00@aws-0-us-east-1.pooler.supabase.com:5432/postgres";
  
  process.env.DATABASE_URL = directUrl;
  process.env.DIRECT_URL = directUrl;
  
  const prisma = new PrismaClient({
    datasourceUrl: directUrl,
  });

  try {
    console.log("Attempting to connect with IPv4 Pooler URL...");
    // Try simple query
    await prisma.$connect();
    console.log("✅ Successfully connected to Supabase!");
    await prisma.$disconnect();
  } catch (e) {
    console.error("❌ Connection failed:", e);
  }
}

main();
