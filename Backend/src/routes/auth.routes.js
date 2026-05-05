import crypto from "crypto";
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
  return passport.authenticate("google", {
    scope: ["profile", "email"],
    // Force account selection every time so Google always issues a fresh code.
    // This prevents stale/replayed codes from a previous session.
    prompt: "select_account",
  })(req, res, next);
});

// Step 2: Google redirects back here after login.
//
// ROOT CAUSE: Render free tier spins down after inactivity. When the OAuth
// callback arrives, the server may still be booting. Render's infrastructure
// can hit the callback URL twice (once during boot probe, once from browser).
// Google's auth code is ONE-TIME USE — the first hit consumes it, the second
// gets `invalid_grant`. Passport then fails silently: req.user never set,
// no session written, no Set-Cookie sent.
//
// FIX: Wrap passport.authenticate in a custom callback so we can intercept
// the `invalid_grant` TokenError explicitly and redirect to a user-friendly
// error page instead of returning a 500 or blank response.
//
router.get("/google/callback", (req, res, next) => {
  if (!isGoogleOAuthConfigured) {
    return res.status(501).json({
      message:
        "Google OAuth is not configured on the server. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_CALLBACK_URL.",
    });
  }

  // Use a custom callback instead of { failureRedirect } so we can inspect
  // the exact error type before deciding what to do.
  passport.authenticate("google", { session: true })(req, res, (err) => {

    // Handle invalid_grant specifically — this is the cold-start race condition.
    // Redirect the user back to login with a clear message so they can retry.
    // A fresh click generates a new code and the server is now warm.
    if (err) {
      const isInvalidGrant =
        err.code === "invalid_grant" ||
        (err.message && err.message.toLowerCase().includes("bad request"));

      if (isInvalidGrant) {
        console.warn(
          "[OAuth] invalid_grant — auth code already used or server was cold. " +
          "Redirecting user to retry login."
        );
        return res.redirect(
          `${process.env.CLIENT_URL}/login?error=please_retry`
        );
      }

      console.error("[OAuth] passport.authenticate error:", err);
      return next(err);
    }

    // If passport succeeded but req.user is still missing, something is wrong
    // with deserialization or the DB lookup — log it and redirect cleanly.
    if (!req.user) {
      console.error(
        "[OAuth] No user on req after successful authenticate. " +
        "Check passport.deserializeUser and MongoDB connection."
      );
      return res.redirect(
        `${process.env.CLIENT_URL}/login?error=oauth_failed`
      );
    }

    console.log("[OAuth] Authenticated user:", req.user.email);

    req.session.save((saveErr) => {
      if (saveErr) {
        console.error("[OAuth] Session save failed:", saveErr);
        return res.redirect(
          `${process.env.CLIENT_URL}/login?error=session_failed`
        );
      }

      console.log("[OAuth] Session saved. ID:", req.session.id);

      const clientUrl = String(process.env.CLIENT_URL).replace(/['"<>]/g, "");
      const nonce = crypto.randomBytes(16).toString("base64");

      res.set({
        "Cache-Control":     "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma":            "no-cache",
        "Expires":           "0",
        "Surrogate-Control": "no-store",
        "Vary":              "*",
        "Referrer-Policy":   "no-referrer",
        "Content-Security-Policy":
          `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'`,
      });

      res.status(200).send(`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Logging in...</title>
    <style>
      *, *::before, *::after { box-sizing: border-box; }
      body {
        margin: 0;
        background: #0d0d0d;
        color: #555;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        font-family: sans-serif;
        font-size: 13px;
        gap: 16px;
      }
      .spinner {
        width: 28px;
        height: 28px;
        border: 2px solid rgba(255, 255, 255, 0.08);
        border-top-color: #ff3c3c;
        border-radius: 50%;
        animation: spin 0.7s linear infinite;
      }
      @keyframes spin { to { transform: rotate(360deg); } }
      a { color: #ff3c3c; }
    </style>
  </head>
  <body>
    <div class="spinner"></div>
    <span>Logging in...</span>
    <noscript>
      <p>Click <a href="${clientUrl}">here</a> to continue.</p>
    </noscript>
    <script nonce="${nonce}">
      window.location.replace("${clientUrl}");
    </script>
  </body>
</html>`);
    });
  });
});

// Diagnostic — remove after confirming login works
router.get("/session-debug", (req, res) => {
  res.json({
    sessionID:       req.sessionID ?? null,
    isAuthenticated: req.isAuthenticated(),
    user:            req.user ?? null,
    cookie:          req.session?.cookie ?? null,
  });
});

router.get("/me", getMe);
router.post("/logout", logout);

export default router;