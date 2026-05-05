import User from "../models/User.model.js";
import Confession from "../models/confession.model.js";

const PUBLISHED_VISIBILITY_FILTER = {
  $or: [
    { status: { $in: ["published", "public"] } },
    // Backward-compat: older documents may not have a status field
    { status: { $exists: false } },
  ],
};

const clampInt = (value, { min, max, defaultValue }) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return defaultValue;
  return Math.min(max, Math.max(min, parsed));
};

// GET /api/users/me — get current user profile with stats
const getMyProfile = async (req, res) => {
  try {
    const userId = req.user.googleId;

    // Find or create user record
    let user = await User.findOne({ googleId: userId });
    if (!user) {
      user = await User.create({
        googleId: userId,
        email: req.user.email,
        displayName: req.user.displayName,
        avatar: req.user.avatar,
      });
    }

    // Get user stats
    const [publishedCount, draftCount] = await Promise.all([
      Confession.countDocuments({ userId, ...PUBLISHED_VISIBILITY_FILTER }),
      Confession.countDocuments({ userId, status: "draft" }),
    ]);

    return res.json({
      user: {
        googleId: user.googleId,
        email: user.email,
        displayName: user.displayName,
        avatar: user.avatar,
        bio: user.bio,
        createdAt: user.createdAt,
      },
      stats: {
        published: publishedCount,
        drafts: draftCount,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

// PUT /api/users/me — update profile
const updateMyProfile = async (req, res) => {
  try {
    const userId = req.user.googleId;
    const { bio } = req.body;

    let user = await User.findOne({ googleId: userId });
    if (!user) {
      user = await User.create({
        googleId: userId,
        email: req.user.email,
        displayName: req.user.displayName,
        avatar: req.user.avatar,
        bio: bio?.trim() || "",
      });
    } else {
      user.bio = bio?.trim() || "";
      await user.save();
    }

    return res.json({
      googleId: user.googleId,
      displayName: user.displayName,
      avatar: user.avatar,
      bio: user.bio,
    });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

// GET /api/users/me/confessions — get all user's confessions (published + drafts)
const getMyConfessions = async (req, res) => {
  try {
    const userId = req.user.googleId;
    const { status, page = 1, limit = 12 } = req.query;

    const pageNum = clampInt(page, { min: 1, max: 100000, defaultValue: 1 });
    const limitNum = clampInt(limit, { min: 1, max: 50, defaultValue: 12 });

    const query = { userId };
    if (status) {
        if (!["draft", "published"].includes(status)) {
        return res.status(400).json({ message: "Invalid status." });
      }

      if (status === "draft") {
        query.status = "draft";
      } else {
        Object.assign(query, PUBLISHED_VISIBILITY_FILTER);
      }
    }

    const skip = (pageNum - 1) * limitNum;

    const [confessions, total] = await Promise.all([
      Confession.find(query)
        .select("-secretCode")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Confession.countDocuments(query),
    ]);

    const validTypes = ["like", "love", "laugh"];
    const shaped = confessions.map((c) => ({
      _id: c._id,
      text: c.text,
      tags: c.tags,
      status: c.status,
      commentCount: c.commentCount,
      viewCount: c.viewCount,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      isOwner: true,
      reactions: {
        like: c.reactions.like.length,
        love: c.reactions.love.length,
        laugh: c.reactions.laugh.length,
      },
      userReactions: validTypes.filter((t) => c.reactions[t].includes(userId)),
    }));

    return res.json({
      confessions: shaped,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

export { getMyProfile, updateMyProfile, getMyConfessions };