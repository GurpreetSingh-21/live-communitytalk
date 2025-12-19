// backend/routes/datingRoutes.js
const express = require("express");
const router = express.Router();
const prisma = require("../prisma/client");
const authenticate = require("../middleware/authenticate");

// All routes require a valid JWT
router.use(authenticate);

// ─────────────────────────────────────────────────────────────────────────────
// DATA SELECTION HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const datingProfileSelect = {
  id: true,
  firstName: true,
  collegeSlug: true,
  photos: true,
  bio: true,
  gender: true,
  hobbies: true,        // Replaced 'seeking' with preferences model
  year: true,           // Replaced 'yearOfStudy'
  major: true,
  height: true,
  age: true,            // Computed from birthDate in API? Or we send birthDate?
  birthDate: true,      // Let frontend compute age
  isPhotoVerified: true,
  isProfileVisible: true,
  userId: true,
};

// ─────────────────────────────────────────────────────────────────────────────
// API ROUTES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/dating/profile/me
 * Fetch my profile + preferences
 */
router.get("/profile/me", async (req, res) => {
  try {
    const profile = await prisma.datingProfile.findUnique({
      where: { userId: req.user.id },
      include: {
        photos: {
          orderBy: { order: 'asc' }
        },
        preference: true,
      }
    });

    // Return null if not created yet (Frontend handles onboarding redirect)
    return res.json(profile);
  } catch (err) {
    console.error("GET /api/dating/profile/me error", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * POST /api/dating/profile
 * Create or Update Profile & Preferences
 */
router.post("/profile", async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      firstName,
      bio,
      gender,
      birthDate, // ISO String
      height,
      major,
      year,
      collegeSlug,
      hobbies,
      instagramHandle,
      // Photos (Array of strings? Or handled via upload route FIRST, then passed as URLs?)
      // Let's assume we receive an array of objects or URLs. 
      // For simplicity in Phase 1: We'll assume a separate photo management or receiving URLs here.
      photos, // Array of { url, isMain } or just strings
      // Preferences
      preferences
    } = req.body;

    if (!firstName || !gender || !birthDate) {
      return res.status(400).json({ error: "Missing required fields (Name, Gender, BirthDate)" });
    }

    // 1. Transaction to handle Profile + Preferences + Photos
    const result = await prisma.$transaction(async (tx) => {

      // Upsert Profile
      const profile = await tx.datingProfile.upsert({
        where: { userId },
        create: {
          userId,
          firstName,
          gender, // Ensure valid Enum
          birthDate: new Date(birthDate),
          bio,
          height: height ? parseInt(height) : null,
          major,
          year,
          collegeSlug: collegeSlug || req.user.collegeSlug || 'unknown',
          hobbies: hobbies || [],
          instagramHandle,
          isProfileVisible: true,
        },
        update: {
          firstName,
          bio,
          height: height ? parseInt(height) : null,
          major,
          year,
          hobbies: hobbies || [],
          instagramHandle,
          // Don't update gender/birthDate trivially if it affects matching logic? Allowing for now.
        }
      });

      // Upsert Preferences
      if (preferences) {
        await tx.datingPreference.upsert({
          where: { datingProfileId: profile.id },
          create: {
            datingProfileId: profile.id,
            ageMin: preferences.ageMin || 18,
            ageMax: preferences.ageMax || 30,
            maxDistance: preferences.maxDistance || 50,
            interestedInGender: preferences.interestedInGender || [], // Enum array
            preferredColleges: preferences.preferredColleges || [],
            showToPeopleOnCampusOnly: preferences.showToPeopleOnCampusOnly || false
          },
          update: {
            ageMin: preferences.ageMin,
            ageMax: preferences.ageMax,
            maxDistance: preferences.maxDistance,
            interestedInGender: preferences.interestedInGender,
            preferredColleges: preferences.preferredColleges,
            showToPeopleOnCampusOnly: preferences.showToPeopleOnCampusOnly
          }
        });
      }

      // Handle Photos (Simple Replace Strategy for MVP)
      // If photos provided, delete old and create new
      if (photos && Array.isArray(photos)) {
        await tx.datingPhoto.deleteMany({ where: { datingProfileId: profile.id } });

        // Disable bulk create due to SQLite/Postgres differences in some Prisma versions? No, createMany is fine.
        await tx.datingPhoto.createMany({
          data: photos.map((p, idx) => ({
            datingProfileId: profile.id,
            url: typeof p === 'string' ? p : p.url,
            isMain: idx === 0, // First one is main?
            order: idx
          }))
        });
      }

      return profile;
    });

    return res.json(result);

  } catch (err) {
    console.error("POST /api/dating/profile error", err);
    res.status(500).json({ error: "Server error: " + err.message });
  }
});

/**
 * GET /api/dating/pool
 * Get swipe candidates using relational logic
 */
router.get("/pool", async (req, res) => {
  try {
    const userId = req.user.id;

    // 1. Get My Profile & Preferences
    const myProfile = await prisma.datingProfile.findUnique({
      where: { userId },
      include: { preference: true }
    });

    if (!myProfile) return res.status(400).json({ error: "Create a profile first" });

    // 2. Get IDs I have ALREADY swiped (Left or Right)
    const swipedRecords = await prisma.datingSwipe.findMany({
      where: { swiperId: myProfile.id },
      select: { targetId: true }
    });
    const swipedIds = swipedRecords.map(r => r.targetId);

    // 2b. Get IDs related to BLOCKS (I blocked them OR they blocked me)
    const blocksGiven = await prisma.datingBlock.findMany({
      where: { blockerId: myProfile.id },
      select: { blockedId: true }
    });
    const blocksReceived = await prisma.datingBlock.findMany({
      where: { blockedId: myProfile.id },
      select: { blockerId: true }
    });

    const blockedIds = [
      ...blocksGiven.map(b => b.blockedId),
      ...blocksReceived.map(b => b.blockerId)
    ];

    // Add myself and blocked/swiped users to exclude list
    const excludeIds = [myProfile.id, ...swipedIds, ...blockedIds];

    // 3. Define Filters based on Preferences
    const prefs = myProfile.preference || {};
    const ageMin = prefs.ageMin || 18;
    const ageMax = prefs.ageMax || 100;
    const interestedGenders = prefs.interestedInGender || []; // If empty, maybe show all (or none)? 
    // Logic: if empty, show all? Or usually enforce setting it.

    // 4. Calculate Date Range for Age
    const today = new Date();
    const minDate = new Date(today.getFullYear() - ageMax - 1, today.getMonth(), today.getDate());
    const maxDate = new Date(today.getFullYear() - ageMin, today.getMonth(), today.getDate());

    // 5. Query Candidates
    // Note: This is basic. For scale, use raw SQL or PostGIS for distance.
    const candidates = await prisma.datingProfile.findMany({
      where: {
        id: { notIn: excludeIds },
        isProfileVisible: true,
        isPaused: false, // Replaced isSuspended
        // approvalStatus: 'APPROVED', // Optional: Uncomment to enforce moderation
        // Match Age
        birthDate: {
          gte: minDate,
          lte: maxDate
        },
        // Match Gender (Candidate is what I want)
        ...(interestedGenders.length > 0 && {
          gender: { in: interestedGenders }
        }),
        // Match Reciprocal Gender (I am what Candidate wants)
        // With Prisma, doing deep relation filtering can be expensive or have limitations.
        // For MVP, straightforward logic is better.
        preference: {
          interestedInGender: { has: myProfile.gender }
        },
        // College Scope (Optional)
        ...(prefs.showToPeopleOnCampusOnly && {
          collegeSlug: myProfile.collegeSlug
        })
      },
      include: {
        photos: {
          where: { isMain: true },
          take: 1
        }
      },
      take: 20 // Batch size
    });

    // Shuffle results
    const shuffled = candidates.sort(() => 0.5 - Math.random());

    res.json(shuffled);

  } catch (err) {
    console.error("GET /api/dating/pool error", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * POST /api/dating/swipe
 * Handle Like/Pass actions & Matching
 */
router.post("/swipe", async (req, res) => {
  try {
    const userId = req.user.id;
    const { targetId, type } = req.body; // type: 'LIKE' | 'DISLIKE' | 'SUPERLIKE'

    if (!['LIKE', 'DISLIKE', 'SUPERLIKE'].includes(type)) {
      return res.status(400).json({ error: "Invalid swipe type" });
    }

    const myProfile = await prisma.datingProfile.findUnique({ where: { userId } });
    if (!myProfile) return res.status(400).json({ error: "No profile" });

    // 1. Prevent duplicate swipe
    // (Prisma unique constraint on swiperId_targetId handles this, but custom check details nice error)
    const existing = await prisma.datingSwipe.findUnique({
      where: {
        swiperId_targetId: {
          swiperId: myProfile.id,
          targetId
        }
      }
    });

    if (existing) return res.json({ message: "Already swiped" });

    // 2. Create Swipe Record
    await prisma.datingSwipe.create({
      data: {
        swiperId: myProfile.id,
        targetId,
        type
      }
    });

    // 3. If PASS, simple return
    if (type === 'DISLIKE') {
      return res.json({ isMatch: false });
    }

    // 4. If LIKE, check for MATCH
    // Look for a swipe where swiper=Target AND target=Me AND type=LIKE/SUPERLIKE
    const otherSwipe = await prisma.datingSwipe.findFirst({
      where: {
        swiperId: targetId,
        targetId: myProfile.id,
        type: { in: ['LIKE', 'SUPERLIKE'] }
      }
    });

    if (otherSwipe) {
      // IT'S A MATCH! 🎉

      // Sort IDs to ensure unique constraint on relations (profile1Id < profile2Id)
      // Actually my schema has MatchProfile1 and MatchProfile2 relation names
      // Usually best to sort IDs to prevent duplicates A-B vs B-A
      const [p1, p2] = [myProfile.id, targetId].sort();

      const match = await prisma.datingMatch.create({
        data: {
          profile1Id: p1,
          profile2Id: p2,
          isActive: true
        }
      });

      // Fetch target info to return
      const matchedProfile = await prisma.datingProfile.findUnique({
        where: { id: targetId },
        select: { firstName: true, photos: { take: 1 } }
      });

      // Emit Socket Event (if IO available)
      if (req.io) {
        // Need Target's userId to send socket (datingProfile doesn't have it directly in select above? wait I need to fetch it)
        const targetUser = await prisma.datingProfile.findUnique({ where: { id: targetId }, select: { userId: true } });
        if (targetUser) {
          req.io.to(targetUser.userId).emit("match:new", {
            matchId: match.id,
            partnerName: myProfile.firstName,
            partnerId: myProfile.id
          });
        }
        // Notify Me (Client handles the immediate response, but socket ensures consistency)
      }

      return res.json({ isMatch: true, matchDetails: { ...match, partner: matchedProfile } });
    }

    return res.json({ isMatch: false });

  } catch (err) {
    console.error("POST /api/dating/swipe error", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /api/dating/matches
 * List Matches
 */
router.get("/matches", async (req, res) => {
  try {
    const userId = req.user.id;
    const myProfile = await prisma.datingProfile.findUnique({ where: { userId } });
    if (!myProfile) return res.json([]);

    // Find matches where I am p1 OR p2
    const matches = await prisma.datingMatch.findMany({
      where: {
        OR: [
          { profile1Id: myProfile.id },
          { profile2Id: myProfile.id }
        ],
        isActive: true
      },
      include: {
        profile1: {
          include: { photos: { where: { isMain: true } } }
        },
        profile2: {
          include: { photos: { where: { isMain: true } } }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    // Format for frontend (flatten structure to just show "partner")
    const formatted = matches.map(m => {
      const isP1 = m.profile1Id === myProfile.id;
      const partner = isP1 ? m.profile2 : m.profile1;
      return {
        matchId: m.id,
        partnerId: partner.id,
        firstName: partner.firstName,
        photo: partner.photos[0]?.url || null,
        updatedAt: m.updatedAt
      };
    });

    res.json(formatted);

  } catch (err) {
    console.error("GET /api/dating/matches error", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * POST /api/dating/report
 * Report a User
 */
router.post("/report", async (req, res) => {
  try {
    const userId = req.user.id;
    const { targetId, reason, details } = req.body;

    if (!targetId || !reason) {
      return res.status(400).json({ error: "Target ID and reason are required" });
    }

    // Resolve target userId from datingProfileId
    const targetProfile = await prisma.datingProfile.findUnique({
      where: { id: targetId },
      select: { userId: true }
    });

    if (!targetProfile) return res.status(404).json({ error: "Target profile not found" });

    await prisma.report.create({
      data: {
        reporterId: userId,
        reportedId: targetProfile.userId,
        reason,
        details,
        targetType: "dating_profile",
        targetId,
        status: "pending"
      }
    });

    res.json({ message: "Report submitted. Thank you for keeping us safe." });
  } catch (err) {
    console.error("POST /api/dating/report error", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * POST /api/dating/block
 * Block a user (Remove from matches, prevent future seeing)
 */
router.post("/block", async (req, res) => {
  try {
    const userId = req.user.id;
    const { targetId } = req.body; // DatingProfile ID of person to block

    if (!targetId) return res.status(400).json({ error: "Target ID is required" });

    const myProfile = await prisma.datingProfile.findUnique({ where: { userId } });
    if (!myProfile) return res.status(400).json({ error: "No profile" });

    // 1. Create Block Record
    // Use upsert to prevent unique constraint errors if already blocked
    await prisma.datingBlock.upsert({
      where: {
        blockerId_blockedId: {
          blockerId: myProfile.id,
          blockedId: targetId
        }
      },
      create: {
        blockerId: myProfile.id,
        blockedId: targetId
      },
      update: {}
    });

    // 2. Remove any existing Match
    // Matches logic uses profile1Id < profile2Id
    const [p1, p2] = [myProfile.id, targetId].sort();

    // Deactivate/Delete Match
    // We can delete or set isActive=false. Let's delete to be "never existed" or isActive=false to keep history.
    // Schema has isActive. Let's use that.
    await prisma.datingMatch.updateMany({
      where: {
        profile1Id: p1,
        profile2Id: p2
      },
      data: {
        isActive: false,
        unmatchedBy: myProfile.id
      }
    });

    // 3. Remove Swipes (Optional, but cleaner)
    await prisma.datingSwipe.deleteMany({
      where: {
        OR: [
          { swiperId: myProfile.id, targetId: targetId },
          { swiperId: targetId, targetId: myProfile.id }
        ]
      }
    });

    res.json({ message: "User blocked" });

  } catch (err) {
    console.error("POST /api/dating/block error", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;