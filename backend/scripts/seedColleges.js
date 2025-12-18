require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Helper
function slugify(str = "") {
    return String(str)
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9\-]/g, "")
        .replace(/\-+/g, "-");
}

/* ============================================================
    FULL CUNY DEFINITIONS (Name + Key + Borough + Optional Domains)
   ============================================================ */

const CUNY_COLLEGES = [
    // ------------------ 4-YEAR COLLEGES ------------------
    {
        name: "Baruch College",
        key: "baruch",
        borough: "manhattan",
        emailDomains: ["baruchmail.cuny.edu", "baruch.cuny.edu"],
    },
    {
        name: "Hunter College",
        key: "hunter",
        borough: "manhattan",
        emailDomains: ["hunter.cuny.edu", "myhunter.cuny.edu"],
    },
    {
        name: "City College of New York",
        key: "ccny",
        borough: "manhattan",
        emailDomains: ["ccny.cuny.edu", "citymail.cuny.edu"],
    },
    {
        name: "John Jay College of Criminal Justice",
        key: "johnjay",
        borough: "manhattan",
        emailDomains: ["jjay.cuny.edu", "johnjay.cuny.edu"],
    },
    {
        name: "Lehman College",
        key: "lehman",
        borough: "bronx",
        emailDomains: ["lehman.cuny.edu", "lc.cuny.edu"],
    },
    {
        name: "Brooklyn College",
        key: "brooklyn",
        borough: "brooklyn",
        emailDomains: ["brooklyn.cuny.edu", "bc.cuny.edu"],
    },
    {
        name: "Queens College",
        key: "qc",
        borough: "queens",
        emailDomains: ["qmail.cuny.edu", "qc.cuny.edu"],
    },
    {
        name: "College of Staten Island",
        key: "csi",
        borough: "staten-island",
        emailDomains: ["mail.csi.cuny.edu", "csi.cuny.edu"],
    },
    {
        name: "York College",
        key: "york",
        borough: "queens",
        emailDomains: ["york.cuny.edu", "yorkmail.cuny.edu"],
    },
    {
        name: "Medgar Evers College",
        key: "medgar",
        borough: "brooklyn",
        emailDomains: ["mec.cuny.edu"],
    },
    {
        name: "New York City College of Technology",
        key: "citytech",
        borough: "brooklyn",
        emailDomains: ["citytech.cuny.edu", "mail.citytech.cuny.edu"],
    },

    // ------------------ COMMUNITY COLLEGES ------------------
    {
        name: "LaGuardia Community College",
        key: "lagcc",
        borough: "queens",
        emailDomains: ["lagcc.cuny.edu", "mail.lagcc.cuny.edu"],
    },
    {
        name: "Hostos Community College",
        key: "hostos",
        borough: "bronx",
        emailDomains: ["hostos.cuny.edu"],
    },
    {
        name: "Bronx Community College",
        key: "bcc",
        borough: "bronx",
        emailDomains: ["stu.bcc.cuny.edu", "bcc.cuny.edu"],
    },
    {
        name: "Kingsborough Community College",
        key: "kbcc",
        borough: "brooklyn",
        emailDomains: ["kbcc.cuny.edu", "stu.kbcc.cuny.edu"],
    },
    {
        name: "BMCC - Borough of Manhattan Community College",
        key: "bmcc",
        borough: "manhattan",
        emailDomains: ["stu.bmcc.cuny.edu", "bmcc.cuny.edu"],
    },
    {
        name: "Queensborough Community College",
        key: "qcc",
        borough: "queens",
        emailDomains: ["qcc.cuny.edu"],
    },
    {
        name: "Guttman Community College",
        key: "guttman",
        borough: "manhattan",
        emailDomains: ["mail.guttman.cuny.edu", "guttman.cuny.edu"],
    },

    // ------------------ GRADUATE / PROFESSIONAL ------------------
    {
        name: "CUNY Graduate Center",
        key: "grad-center",
        borough: "manhattan",
        emailDomains: ["gc.cuny.edu", "gradcenter.cuny.edu"],
    },
    {
        name: "CUNY School of Law",
        key: "cunylaw",
        borough: "queens",
        emailDomains: ["lawmail.cuny.edu", "law.cuny.edu"],
    },
    {
        name: "CUNY School of Medicine",
        key: "cunymed",
        borough: "manhattan",
        emailDomains: ["med.cuny.edu"],
    },
    {
        name: "CUNY School of Public Health",
        key: "sph",
        borough: "manhattan",
        emailDomains: ["sph.cuny.edu"],
    },
    {
        name: "Craig Newmark Graduate School of Journalism",
        key: "cnj",
        borough: "manhattan",
        emailDomains: ["journalism.cuny.edu"],
    },
    {
        name: "School of Professional Studies",
        key: "sps",
        borough: "manhattan",
        emailDomains: ["sps.cuny.edu", "mail.sps.cuny.edu"],
    },
    {
        name: "CUNY School of Labor and Urban Studies",
        key: "slus",
        borough: "manhattan",
        emailDomains: ["slu.cuny.edu", "cuny.slus.edu"],
    },
];

/* ============================================================
    MAIN SEEDER
   ============================================================ */

(async () => {
    try {
        console.log("✅ Prisma Client connected");

        // Optional: Clear old generic 'college' communities if you want a fresh start
        // await prisma.community.deleteMany({ where: { type: "college" } });

        for (const c of CUNY_COLLEGES) {
            const slug = slugify(c.key);

            // ---------- 1) Upsert COMMUNITY ----------
            // We map 'borough' to the tags array
            const community = await prisma.community.upsert({
                where: { slug: slug }, // Using slug as the unique constraint if available
                update: {
                    name: c.name,
                    key: c.key,
                    type: "college",
                    description: `${c.name} is part of the City University of New York (CUNY) system.`,
                    isPrivate: false,
                    tags: ["cuny", c.borough, c.key],
                },
                create: {
                    name: c.name,
                    key: c.key,
                    slug: slug,
                    type: "college",
                    description: `${c.name} is part of the City University of New York (CUNY) system.`,
                    isPrivate: false,
                    tags: ["cuny", c.borough, c.key],
                },
            });

            // ---------- 2) Upsert COLLEGE DIRECTORY ----------
            await prisma.college.upsert({
                where: { key: c.key },
                update: {
                    name: c.name,
                    emailDomains: c.emailDomains || [],
                    communityId: community.id,
                },
                create: {
                    name: c.name,
                    key: c.key,
                    emailDomains: c.emailDomains || [],
                    communityId: community.id,
                },
            });

            console.log(`✔️ Synced: ${c.name}`);
        }

        console.log("\n🎉 All CUNY colleges seeded & linked successfully!");
        await prisma.$disconnect();
        process.exit(0);
    } catch (err) {
        console.error("❌ Seeder Error:", err);
        await prisma.$disconnect();
        process.exit(1);
    }
})();