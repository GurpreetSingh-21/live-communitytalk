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
    DEFINITION: CUNY COLLEGES
   ============================================================ */
const CUNY_COLLEGES = [
    { name: "Baruch College", key: "baruch", borough: "manhattan" },
    { name: "Hunter College", key: "hunter", borough: "manhattan" },
    { name: "City College of New York", key: "ccny", borough: "manhattan" },
    { name: "John Jay College of Criminal Justice", key: "johnjay", borough: "manhattan" },
    { name: "Lehman College", key: "lehman", borough: "bronx" },
    { name: "Brooklyn College", key: "brooklyn", borough: "brooklyn" },
    { name: "Queens College", key: "qc", borough: "queens" },
    { name: "College of Staten Island", key: "csi", borough: "staten-island" },
    { name: "York College", key: "york", borough: "queens" },
    { name: "Medgar Evers College", key: "medgar", borough: "brooklyn" },
    { name: "New York City College of Technology", key: "citytech", borough: "brooklyn" },
    { name: "LaGuardia Community College", key: "lagcc", borough: "queens" },
    { name: "Hostos Community College", key: "hostos", borough: "bronx" },
    { name: "Bronx Community College", key: "bcc", borough: "bronx" },
    { name: "Kingsborough Community College", key: "kbcc", borough: "brooklyn" },
    { name: "BMCC - Borough of Manhattan Community College", key: "bmcc", borough: "manhattan" },
    { name: "Queensborough Community College", key: "qcc", borough: "queens" },
    { name: "Guttman Community College", key: "guttman", borough: "manhattan" },
    { name: "CUNY Graduate Center", key: "grad-center", borough: "manhattan" },
    { name: "CUNY School of Law", key: "cunylaw", borough: "queens" },
    { name: "CUNY School of Medicine", key: "cunymed", borough: "manhattan" },
    { name: "CUNY School of Public Health", key: "sph", borough: "manhattan" },
    { name: "Craig Newmark Graduate School of Journalism", key: "cnj", borough: "manhattan" },
    { name: "School of Professional Studies", key: "sps", borough: "manhattan" },
    { name: "CUNY School of Labor and Urban Studies", key: "slus", borough: "manhattan" },
];

/* ============================================================
    DEFINITION: COUNTRIES
   ============================================================ */
const COUNTRY_COMMUNITIES = [
    { name: "China" },
    { name: "India" },
    { name: "South Korea" },
    { name: "Jamaica" },
    { name: "Bangladesh" },
    { name: "Nepal" },
    { name: "Turkey" },
    { name: "Colombia" },
    { name: "Italy" },
    { name: "Pakistan" },
    { name: "Pakistan" },
];

/* ============================================================
    DEFINITION: RELIGIONS
   ============================================================ */
const RELIGIONS = [
    { name: "Sikhism", key: "sikhism" },
    { name: "Christianity", key: "christianity" },
    { name: "Islam", key: "islam" },
    { name: "Hinduism", key: "hinduism" },
    { name: "Judaism", key: "judaism" },
    { name: "Buddhism", key: "buddhism" },
    { name: "Atheism", key: "atheism" },
    { name: "Other", key: "other" }
];

/* ============================================================
    MAIN SEEDER
   ============================================================ */
(async () => {
    try {
        console.log("✅ Prisma Client connected");

        // Optional: Clean up the 'global' country communities created previously which were not college-specific
        // Their slugs were just the country slug (e.g. 'china', 'india')
        // We can indentify them because they are in COUNTRY_COMMUNITIES list
        console.log("🧹 Cleaning up old global communities...");
        const globalSlugs = COUNTRY_COMMUNITIES.map(c => slugify(c.name));
        await prisma.community.deleteMany({
            where: {
                slug: { in: globalSlugs }
            }
        });

        // Loop through each COLLEGE
        for (const college of CUNY_COLLEGES) {
            console.log(`\n🏫 Seeding communities for ${college.name} (${college.key})...`);

            // For this college, create each country community
            for (const c of COUNTRY_COMMUNITIES) {
                const countrySlug = slugify(c.name);

                // Unique slug: college-country (e.g. "qc-china")
                const uniqueSlug = `${college.key}-${countrySlug}`;

                // Unique key: same as slug
                // Tags: country, international, country-name, AND THE COLLEGE KEY
                // IMPORTANT: Linking primarily via the college key tag so it shows up in queries
                const tags = ["country", "international", countrySlug, college.key];

                await prisma.community.upsert({
                    where: { slug: uniqueSlug },
                    update: {
                        name: c.name, // Display name is just "China"
                        key: uniqueSlug,
                        type: "custom",
                        isPrivate: false,
                        tags: tags,
                    },
                    create: {
                        name: c.name,
                        key: uniqueSlug,
                        slug: uniqueSlug,
                        type: "custom",
                        isPrivate: false,
                        tags: tags,
                    },
                });
            }
        }

        // SEED RELIGIONS (Global)
        console.log("\n🙏 Seeding Religions...");
        for (const rel of RELIGIONS) {
            const uniqueSlug = `religion-${rel.key}`;
            await prisma.community.upsert({
                where: { slug: uniqueSlug },
                update: {
                    name: rel.name,
                    key: uniqueSlug,
                    type: "religion", // ENUM defined as 'religion'
                    isPrivate: false,
                    tags: ["religion", rel.key],
                },
                create: {
                    name: rel.name,
                    key: uniqueSlug,
                    slug: uniqueSlug,
                    type: "religion",
                    isPrivate: false,
                    tags: ["religion", rel.key],
                }
            });
        }

        console.log("\n🎉 All college-specific and religion communities seeded successfully!");
        await prisma.$disconnect();
        process.exit(0);
    } catch (err) {
        console.error("❌ Seeder Error:", err);
        await prisma.$disconnect();
        process.exit(1);
    }
})();
