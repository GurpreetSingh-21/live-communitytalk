// backend/scripts/update-domains.js
require("dotenv").config();
const mongoose = require("mongoose");
const Community = require("../models/college");
const { connectDB } = require("../db"); // Ensure this path is correct relative to where you run the script

(async () => {
  try {
    await connectDB();
    console.log("✅ Connected to DB");

    // List of CUNY colleges to update/insert
    const colleges = [
      {
        name: "Queens College",
        key: "qc",
        emailDomains: ["qmail.cuny.edu", "qc.cuny.edu"],
      },
      {
        name: "Baruch College",
        key: "baruch",
        emailDomains: ["baruchmail.cuny.edu", "baruch.cuny.edu"],
      },
      {
        name: "Hunter College",
        key: "hunter",
        emailDomains: ["hunter.cuny.edu", "myhunter.cuny.edu"],
      },
      {
        name: "City College of New York",
        key: "ccny",
        emailDomains: ["ccny.cuny.edu", "citymail.cuny.edu"],
      },
      {
        name: "Brooklyn College",
        key: "brooklyn",
        emailDomains: ["brooklyn.cuny.edu", "bc.cuny.edu"],
      },
      {
        name: "John Jay College",
        key: "jjay",
        emailDomains: ["jjay.cuny.edu"],
      },
      {
        name: "Lehman College",
        key: "lehman",
        emailDomains: ["lehman.cuny.edu", "lc.cuny.edu"],
      },
      {
        name: "York College",
        key: "york",
        emailDomains: ["york.cuny.edu", "yorkmail.cuny.edu"],
      },
    ];

    for (const c of colleges) {
      // Try to find by name OR key to update existing records
      const filter = {
        $or: [
          { name: { $regex: new RegExp(`^${c.name}$`, "i") } }, // Case-insensitive name match
          { key: c.key },
        ],
        type: "college", // Ensure we only touch college types
      };

      const update = {
        $set: {
          name: c.name, // Ensure standard name format
          type: "college",
          key: c.key,
        },
        $addToSet: {
          emailDomains: { $each: c.emailDomains }, // Add new domains without duplicates
        },
      };

      // upsert: true will create it if it doesn't exist
      const result = await Community.updateOne(filter, update, { upsert: true });

      if (result.upsertedCount > 0) {
        console.log(`✨ Created: ${c.name}`);
      } else if (result.modifiedCount > 0) {
        console.log(`🔄 Updated: ${c.name}`);
      } else {
        console.log(`👌 No changes: ${c.name}`);
      }
    }

    console.log("\n🎉 Done updating CUNY colleges!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
})();