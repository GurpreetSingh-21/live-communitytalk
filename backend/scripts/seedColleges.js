require("dotenv").config();
const mongoose = require("mongoose");
const { connectDB } = require("../db");
const Community = require("../models/Community");
const College = require("../models/College");

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
    This merges your friend's list + master CUNY list.
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
    await connectDB();
    console.log("✅ Connected to DB");

    console.log("🗑️ Removing old college communities...");
    await Community.deleteMany({ type: "college" });

    for (const c of CUNY_COLLEGES) {
      const slug = slugify(c.key);

      // ---------- 1) Upsert COMMUNITY ----------
      const community = await Community.findOneAndUpdate(
        {
          $or: [{ key: c.key }, { slug }],
          type: "college",
        },
        {
          $set: {
            name: c.name,
            key: c.key,
            slug,
            type: "college",
            description: `${c.name} is part of the City University of New York (CUNY) system.`,
            isPrivate: false,
            tags: ["cuny", c.borough, c.key],
          },
        },
        { new: true, upsert: true }
      );

      // ---------- 2) Upsert COLLEGE DIRECTORY ----------
      await College.findOneAndUpdate(
        { key: c.key },
        {
          $set: {
            name: c.name,
            key: c.key,
            communityId: community._id,
            borough: c.borough,
          },
          $addToSet: {
            emailDomains: { $each: c.emailDomains || [] },
          },
        },
        { upsert: true, new: true }
      );

      console.log(`✔️ Synced: ${c.name}`);
    }

    console.log("\n🎉 All CUNY colleges seeded & linked successfully!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Seeder Error:", err);
    process.exit(1);
  }
})();