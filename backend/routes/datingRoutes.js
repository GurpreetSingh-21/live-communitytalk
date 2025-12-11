// backend/routes/datingRoutes.js
const express = require("express");
const router = express.Router();
const prisma = require("../prisma/client");
const authenticate = require("../middleware/authenticate");

// All routes require a valid JWT
router.use(authenticate);

// Helper: fields to select (Prisma select object)
const datingProfileSelect = {
  id: true,
  name: true,
  collegeSlug: true,
  religionKey: true,
  photos: true,
  bio: true,
  gender: true,
  seeking: true,
  yearOfStudy: true,
  isPhotoApproved: true,
  isProfileVisible: true,
  isSuspended: true,
  userId: true, // Needed for ownership checks
};

/* ------------------------------------------------------------------ *
 * UTILS
 * ------------------------------------------------------------------ */

// Fisher-Yates Shuffle for random sampling
function shuffle(array) {
  let currentIndex = array.length, randomIndex;
  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
  }
  return array;
}

/* ------------------------------------------------------------------ *
 * ROUTES
 * ------------------------------------------------------------------ */

// POST /api/dating/profile - Create or Update Profile
router.post("/profile", async (req, res) => {
  try {
    const userId = req.user.id;
    // Basic validation
    // Allowed fields: name, bio, gender, seeking (array), yearOfStudy, photos (array)
    // Scope is derived from user (collegeSlug, religionKey) usually, or passed in?
    // In Mongoose version, it might have been passed. Let's assume passed or derived.
    // We'll trust body for now but should sanity check.

    const {
      name,
      bio,
      gender,
      seeking,
      yearOfStudy,
      photos,
      collegeSlug,
      religionKey
    } = req.body;

    if (!name || !gender) {
      return res.status(400).json({ error: "Name and Gender are required" });
    }

    // Upsert profile
    const profile = await prisma.datingProfile.upsert({
      where: { userId },
      create: {
        userId,
        name,
        bio,
        gender,
        seeking: Array.isArray(seeking) ? seeking : [],
        yearOfStudy,
        photos: Array.isArray(photos) ? photos : [],
        collegeSlug: collegeSlug || req.user.collegeSlug,
        religionKey: religionKey || req.user.religionKey,
        isProfileVisible: true, // Default to visible on create?
      },
      update: {
        name,
        bio,
        gender,
        seeking: Array.isArray(seeking) ? seeking : [],
        yearOfStudy,
        photos: Array.isArray(photos) ? photos : [],
        // don't update slug/key unless necessary?
        // Let's allow update if provided
        ...(collegeSlug && { collegeSlug }),
        ...(religionKey && { religionKey }),
      },
      select: datingProfileSelect
    });

    return res.json(profile);
  } catch (err) {
    console.error("POST /api/dating/profile error", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/dating/profile/me - Get my profile
router.get("/profile/me", async (req, res) => {
  try {
    const profile = await prisma.datingProfile.findUnique({
      where: { userId: req.user.id },
      select: datingProfileSelect
    });
    // Return null or empty object if not found? Frontend expects something?
    // Usually 200 with null is fine or 404.
    if (!profile) return res.json(null);
    return res.json(profile);
  } catch (err) {
    console.error("GET /api/dating/profile/me error", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/dating/pool - Get random candidates
router.get("/pool", async (req, res) => {
  try {
    const userId = req.user.id;
    const myProfile = await prisma.datingProfile.findUnique({
      where: { userId },
      select: {
          id: true,
          gender: true,
          seeking: true,
          collegeSlug: true,
          likes: true,
          dislikes: true,
          matches: true
      }
    });

    if (!myProfile) {
      return res.status(400).json({ error: "Create a profile first" });
    }

    // Filter logic:
    // 1. Must be visible and approved
    // 2. Not suspended
    // 3. Not Me
    // 4. Matches my seeking preference (Candidate Gender IN My Seeking)
    // 5. Matches candidate's seeking preference (My Gender IN Candidate Seeking)
    // 6. Match college/scope? (Optional, but usually yes)
    // 7. Not in my likes/dislikes/matches

    const excludeIds = [
        myProfile.id,
        ...myProfile.likes,
        ...myProfile.dislikes,
        ...myProfile.matches
    ];

    // fetch CANDIDATES
    // Since we need RANDOM and Prisma NO random, we fetch ID list first or chunk.
    // Optimization: If user base is huge, this is slow. 
    // For now (MVP): Fetch larger set, shuffle in memory, take X.

    const rawCandidates = await prisma.datingProfile.findMany({
        where: {
            id: { notIn: excludeIds },
            isProfileVisible: true,
            isPhotoApproved: true,
            isSuspended: false,
            collegeSlug: myProfile.collegeSlug, // Scope by college
            gender: { in: myProfile.seeking }, // They are what I want
            seeking: { has: myProfile.gender } // I am what they want
        },
        select: datingProfileSelect,
        take: 100 // Fetch up to 100 potential matches
    });

    // Shuffle and pick
    const shuffled = shuffle(rawCandidates);
    const selected = shuffled.slice(0, 20); // Return 20

    res.json(selected);
  } catch (err) {
    console.error("GET /api/dating/pool error", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/dating/swipe - Like or Dislike
router.post("/swipe", async (req, res) => {
    try {
        const userId = req.user.id;
        const { targetId, action } = req.body; // action: 'like' | 'dislike'

        if (!['like', 'dislike'].includes(action)) {
            return res.status(400).json({ error: "Invalid action" });
        }
        if (!targetId) return res.status(400).json({ error: "Target ID required" });

        const myProfile = await prisma.datingProfile.findUnique({
            where: { userId }
        });
        if (!myProfile) return res.status(400).json({ error: "No profile" });

        // Check if already processed
        if (myProfile.likes.includes(targetId) || 
            myProfile.dislikes.includes(targetId) || 
            myProfile.matches.includes(targetId)) {
            return res.json({ message: "Already processed" });
        }

        if (action === 'dislike') {
            await prisma.datingProfile.update({
                where: { id: myProfile.id },
                data: { dislikes: { push: targetId } }
            });
            return res.json({ message: "Disliked" });
        }

        // Action is LIKE
        // Check if mutual like (Target likes Me)
        const targetProfile = await prisma.datingProfile.findUnique({
            where: { id: targetId },
            select: { id: true, likes: true, userId: true } // Need userId to notify
        });

        if (!targetProfile) return res.status(404).json({ error: "Profile not found" });

        const isMutual = targetProfile.likes.includes(myProfile.id);

        if (isMutual) {
            // MATCH!
            // 1. Add match to both
            // 2. Remove from likes if needed? (Usually move from like to match, or just keep in likes + match list)
            // Let's say 'matches' array stores confirmed matches.
            
            // Transaction for atomicity
            await prisma.$transaction([
                // Update Me: Add to likes AND matches
                prisma.datingProfile.update({
                    where: { id: myProfile.id },
                    data: {
                        likes: { push: targetId },
                        matches: { push: targetId }
                    }
                }),
                // Update Target: Add Me to matches (I am already in their likes)
                prisma.datingProfile.update({
                    where: { id: targetId },
                    data: {
                        matches: { push: myProfile.id }
                    }
                })
            ]);

            // Emit Socket event to both?
            // "match:new"
            // Need user IDs for sockets.
            // myProfile.userId and targetProfile.userId
            req.io?.to(userId).emit("match:new", { withId: targetProfile.id });
            req.io?.to(targetProfile.userId).emit("match:new", { withId: myProfile.id });

            return res.json({ message: "It's a Match!", match: true });
        } else {
            // Just a like
            await prisma.datingProfile.update({
                where: { id: myProfile.id },
                data: { likes: { push: targetId } }
            });
            return res.json({ message: "Liked", match: false });
        }

    } catch (err) {
        console.error("POST /api/dating/swipe error", err);
        res.status(500).json({ error: "Server error" });
    }
});

// GET /api/dating/matches - Get list of matches
router.get("/matches", async (req, res) => {
    try {
        const userId = req.user.id;
        const myProfile = await prisma.datingProfile.findUnique({
            where: { userId },
            select: { matches: true }
        });
        if (!myProfile) return res.json([]);

        if (myProfile.matches.length === 0) return res.json([]);

        const matches = await prisma.datingProfile.findMany({
            where: { id: { in: myProfile.matches } },
            select: datingProfileSelect
        });

        res.json(matches);
    } catch (err) {
        console.error("GET /api/dating/matches error", err);
        res.status(500).json({ error: "Server error" });
    }
});

module.exports = router;