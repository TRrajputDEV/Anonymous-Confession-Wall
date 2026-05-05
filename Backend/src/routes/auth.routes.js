import express from "express";
import passport from "passport";
import { getMe, logout } from "../controllers/auth.controller.js";

const router = express.Router();

const isGoogleOAuthConfigured =
  Boolean(process.env.GOOGLE_CLIENT_ID) &&
  Boolean(process.env.GOOGLE_CLIENT_SECRET) &&
  Boolean(process.env.GOOGLE_CALLBACK_URL);

// Step 1: Redirect user to Google login page
router.get("/google", (req, res, next) => {
  if (!isGoogleOAuthConfigured) {
    return res.status(501).json({
      message:
        "Google OAuth is not configured on the server. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_CALLBACK_URL.",
    });
  }
  return passport.authenticate("google", { scope: ["profile", "email"] })(
    req,
    res,
    next,
  );
});

// Step 2: Google redirects back here after login
router.get("/google/callback", (req, res, next) => {
  if (!isGoogleOAuthConfigured) {
    return res.status(501).json({
      message:
        "Google OAuth is not configured on the server. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_CALLBACK_URL.",
    });
  }

  passport.authenticate("google", {
    failureRedirect: `${process.env.CLIENT_URL}/login`,
    session: true,
  })(req, res, (err) => {
    if (err) return next(err);

    // 🔥 THIS LINE FIXES YOUR ENTIRE BUG
    req.session.save(() => {
      res.redirect(process.env.CLIENT_URL);
    });
  });
});

// Get currently logged-in user (used by frontend on load)
router.get("/me", getMe);

// Logout and clear session
router.post("/logout", logout);

export default router;