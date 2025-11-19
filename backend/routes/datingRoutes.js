// backend/routes/datingRoutes.js
const express = require("express");
const mongoose = require("mongoose");

const router = express.Router();

const authenticate = require("../middleware/authenticate");
const Person = require("../person");
const DatingProfile = require("../models/DatingProfile");

// All routes require a valid JWT
router.use(authenticate);

// Helper: fields we expose to the client (no likes/dislikes arrays)
const datingProfileProjection = {
  person: 1,
  name: 1,
  collegeSlug: 1,
  religionKey: 1,
  photos: 1,
  bio: 1,
  gender: 1,
  seeking: 1,
  yearOfStudy: 1,
  isProfileVisible: 1,
  isPhotoApproved: 1,
  isSuspended: 1,
  createdAt: 1,
  updatedAt: 1,
};

const ALL_GENDERS = ["male", "female", "nonbinary", "other"];

/* ------------------------------------------------------------------ *
 * PROFILE MANAGEMENT
 * ------------------------------------------------------------------ */

/**
 * GET /api/dating/profile
 * Get the current user's dating profile
 */
router.get("/profile", async (req, res) => {
  try {
    const profile = await DatingProfile.findOne({ person: req.user.id })
      .select(datingProfileProjection)
      .lean();

    if (!profile) {
      return res.status(404).json({ error: "Dating profile not found" });
    }

    return res.json(profile);
  } catch (err) {
    console.error("GET /api/dating/profile error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * POST /api/dating/profile
 * Create or update the user's dating profile
 * Body: { photos, bio?, gender, seeking?, yearOfStudy? }
 */
router.post("/profile", async (req, res) => {
  const { photos, bio, gender, seeking, yearOfStudy } = req.body || {};
  const userId = req.user.id;

  // Shallow validation (the schema will enforce the rest)
  if (!gender) {
    return res.status(400).json({ error: "Gender is required." });
  }
  if (!Array.isArray(photos) || photos.length < 1 || photos.length > 5) {
    return res
      .status(400)
      .json({ error: "Photos must be an array between 1 and 5 items." });
  }

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    // Get base user identity + scope from Person
    const person = await Person.findById(userId)
      .select("_id fullName email avatar collegeSlug religionKey")
      .session(session)
      .lean();

    if (!person) {
      await session.abortTransaction();
      return res.status(404).json({ error: "User not found" });
    }

    const collegeSlug = person.collegeSlug || req.user.collegeSlug;
    const religionKey = person.religionKey || req.user.religionKey || null;

    if (!collegeSlug) {
      await session.abortTransaction();
      return res.status(400).json({
        error: "User must have a verified college to create a dating profile.",
      });
    }

    // Normalize seeking list a bit here (schema will also normalize)
    const normalizedSeeking = Array.isArray(seeking) && seeking.length > 0
      ? seeking
      : ALL_GENDERS;

    // Upsert dating profile
    const profileDoc = await DatingProfile.findOneAndUpdate(
      { person: userId },
      {
        $set: {
          person: userId,
          name: person.fullName || person.email || "User",
          collegeSlug,
          religionKey,
          photos,
          bio: bio || "",
          gender,
          seeking: normalizedSeeking,
          yearOfStudy: yearOfStudy || "other",

          // Any time the photo set changes, lock visibility until re-approved
          isProfileVisible: false,
          isPhotoApproved: false,
          isSuspended: false,
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        session,
        setDefaultsOnInsert: true,
      }
    )
      .select(datingProfileProjection)
      .lean();

    // Reflect flag on Person
    if (profileDoc?._id) {
      await Person.updateOne(
        { _id: userId },
        {
          $set: {
            hasDatingProfile: true,
            datingProfileId: profileDoc._id,
          },
        },
        { session }
      );
    }

    await session.commitTransaction();

    return res.json({
      message: "Profile saved. Awaiting photo review.",
      profile: profileDoc,
    });
  } catch (err) {
    await session.abortTransaction();
    console.error("POST /api/dating/profile error:", err);

    if (err?.name === "ValidationError") {
      return res.status(400).json({ error: err.message });
    }

    return res.status(500).json({
      error: "An unexpected error occurred during profile setup.",
    });
  } finally {
    session.endSession();
  }
});

/* ------------------------------------------------------------------ *
 * SWIPING & MATCHING
 * ------------------------------------------------------------------ */

/**
 * GET /api/dating/swipe-pool
 * Get a pool of eligible profiles to swipe on.
 */
router.get("/swipe-pool", async (req, res) => {
  try {
    const userProfile = await DatingProfile.findOne({ person: req.user.id })
      .select(
        "collegeSlug religionKey likes dislikes matches gender seeking isProfileVisible isPhotoApproved isSuspended"
      )
      .lean();

    // Must have a live, approved, non-suspended profile
    if (
      !userProfile ||
      !userProfile.isProfileVisible ||
      !userProfile.isPhotoApproved ||
      userProfile.isSuspended
    ) {
      return res.status(400).json({
        error:
          "Profile is not eligible for swiping. Please ensure it is visible, approved, and not suspended.",
      });
    }

    // Profiles already interacted with
    const likes = Array.isArray(userProfile.likes) ? userProfile.likes : [];
    const dislikes = Array.isArray(userProfile.dislikes)
      ? userProfile.dislikes
      : [];
    const matches = Array.isArray(userProfile.matches)
      ? userProfile.matches
      : [];

    const excludedIds = [
      userProfile._id,
      ...likes,
      ...dislikes,
      ...matches,
    ];

    // Base match criteria
    const matchCriteria = {
      _id: { $nin: excludedIds },
      isProfileVisible: true,
      isPhotoApproved: true,
      isSuspended: { $ne: true },
      collegeSlug: userProfile.collegeSlug,
      // They must be seeking the current user's gender
      seeking: userProfile.gender,
      // And their gender must be something the current user is seeking
      gender: { $in: userProfile.seeking || ALL_GENDERS },
    };

    // If user has a religionKey, restrict to same
    if (userProfile.religionKey) {
      matchCriteria.religionKey = userProfile.religionKey;
    }

    // Fetch a random sample of 15
    const pool = await DatingProfile.aggregate([
      { $match: matchCriteria },
      { $sample: { size: 15 } },
      { $project: datingProfileProjection },
    ]);

    return res.json({ pool });
  } catch (err) {
    console.error("GET /api/dating/swipe-pool error:", err);
    return res.status(500).json({ error: "Could not generate swipe pool" });
  }
});

/**
 * POST /api/dating/swipe
 * Handle a user swipe (like or dislike)
 * Body: { targetProfileId: string, type: 'like' | 'dislike' }
 */
router.post("/swipe", async (req, res) => {
  const { targetProfileId, type } = req.body || {};
  const userId = req.user.id;

  if (
    !mongoose.isValidObjectId(targetProfileId) ||
    (type !== "like" && type !== "dislike")
  ) {
    return res.status(400).json({ error: "Invalid input" });
  }

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const [currentUserProfile, targetUserProfile] = await Promise.all([
      DatingProfile.findOne({ person: userId })
        .select("_id likes isProfileVisible isPhotoApproved isSuspended")
        .session(session),
      DatingProfile.findById(targetProfileId)
        .select("_id likes isProfileVisible isPhotoApproved isSuspended")
        .session(session),
    ]);

    if (!currentUserProfile || !targetUserProfile) {
      await session.abortTransaction();
      return res
        .status(404)
        .json({ error: "One or both profiles not found" });
    }

    // Disallow interactions if either profile is not live
    if (
      !currentUserProfile.isProfileVisible ||
      !currentUserProfile.isPhotoApproved ||
      currentUserProfile.isSuspended
    ) {
      await session.abortTransaction();
      return res.status(400).json({
        error:
          "Your dating profile is not eligible to swipe. Please ensure it is visible, approved, and not suspended.",
      });
    }

    if (
      !targetUserProfile.isProfileVisible ||
      !targetUserProfile.isPhotoApproved ||
      targetUserProfile.isSuspended
    ) {
      await session.abortTransaction();
      return res
        .status(400)
        .json({ error: "Target profile is not eligible for swiping." });
    }

    let isMatch = false;

    if (type === "like") {
      // Add target to current user's likes
      await DatingProfile.updateOne(
        { _id: currentUserProfile._id },
        { $addToSet: { likes: targetUserProfile._id } },
        { session }
      );

      const didTargetLikeCurrentUser =
        Array.isArray(targetUserProfile.likes) &&
        targetUserProfile.likes.some((id) =>
          id.equals(currentUserProfile._id)
        );

      if (didTargetLikeCurrentUser) {
        isMatch = true;

        // Add each other to matches
        await Promise.all([
          DatingProfile.updateOne(
            { _id: currentUserProfile._id },
            { $addToSet: { matches: targetUserProfile._id } },
            { session }
          ),
          DatingProfile.updateOne(
            { _id: targetUserProfile._id },
            { $addToSet: { matches: currentUserProfile._id } },
            { session }
          ),
        ]);

        // Clean up dislikes (optional)
        await DatingProfile.updateMany(
          { _id: { $in: [currentUserProfile._id, targetUserProfile._id] } },
          {
            $pull: {
              dislikes: { $in: [currentUserProfile._id, targetUserProfile._id] },
            },
          },
          { session }
        );
      }
    } else if (type === "dislike") {
      // Add target to current user's dislikes
      await DatingProfile.updateOne(
        { _id: currentUserProfile._id },
        { $addToSet: { dislikes: targetUserProfile._id } },
        { session }
      );
    }

    await session.commitTransaction();

    return res.json({
      status: type,
      isMatch,
      targetProfileId,
    });
  } catch (err) {
    await session.abortTransaction();
    console.error("POST /api/dating/swipe error:", err);
    return res.status(500).json({ error: "Swipe failed" });
  } finally {
    session.endSession();
  }
});

/**
 * GET /api/dating/matches
 * Get the list of profiles the current user has matched with.
 */
router.get("/matches", async (req, res) => {
  try {
    const userProfile = await DatingProfile.findOne({ person: req.user.id })
      .select("matches")
      .populate({
        path: "matches",
        select: datingProfileProjection,
      })
      .lean();

    if (!userProfile) {
      return res.json({ matches: [] });
    }

    return res.json({ matches: userProfile.matches || [] });
  } catch (err) {
    console.error("GET /api/dating/matches error:", err);
    return res.status(500).json({ error: "Could not retrieve matches" });
  }
});

module.exports = router;