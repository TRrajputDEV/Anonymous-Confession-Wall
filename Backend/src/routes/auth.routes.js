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
  return passport.authenticate("google", { scope: ["profile", "email"] })(
    req,
    res,
    next,
  );
});

// Step 2: Google redirects back here after login.
//
// WHY NOT res.redirect() (302):
//   Render's reverse proxy — and Cloudflare if present — process the Location
//   header and follow the redirect BEFORE the browser can store the Set-Cookie
//   from this response. Cookie is silently lost. Session never established.
//
// THE FIX — return a 200 HTML page instead:
//   The browser fully processes the 200 response (stores Set-Cookie), THEN
//   the inline script runs window.location.replace(). Cookie is committed
//   before the frontend loads and calls /api/auth/me.
//
// WHY Cache-Control: no-store:
//   Cloudflare (and other CDNs) strip Set-Cookie from any response they cache.
//   no-store tells Cloudflare never to cache this response, so Set-Cookie
//   is passed through to the browser intact.
//
// WHY a CSP nonce:
//   helmet sets Content-Security-Policy: script-src 'self' on all responses,
//   which blocks inline <script> tags. We generate a per-request nonce and
//   override the CSP just for this one response so the redirect script is
//   allowed, while every other route keeps the strict default.
//
router.get("/google/callback", (req, res, next) => {
  if (!isGoogleOAuthConfigured) {
    return res.status(501).json({
      message:
        "Google OAuth is not configured on the server. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_CALLBACK_URL.",
    });
  }

  passport.authenticate("google", {
    failureRedirect: `${process.env.CLIENT_URL}/login?error=oauth_failed`,
    session: true,
  })(req, res, (err) => {
    if (err) return next(err);

    req.session.save((saveErr) => {
      if (saveErr) {
        console.error("Session save error after OAuth:", saveErr);
        return res.redirect(
          `${process.env.CLIENT_URL}/login?error=session_failed`,
        );
      }

      // Sanitize CLIENT_URL — strip characters that could break HTML/JS context
      const clientUrl = String(process.env.CLIENT_URL).replace(/['"<>]/g, "");

      // Per-request nonce — allows this one inline script past helmet's CSP
      const nonce = crypto.randomBytes(16).toString("base64");

      // Cache-Control: no-store is the Cloudflare fix.
      // Cloudflare strips Set-Cookie from cached responses. no-store prevents
      // caching entirely, so Set-Cookie reaches the browser untouched.
      res.set({
        "Cache-Control":     "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma":            "no-cache",
        "Surrogate-Control": "no-store",
        "Referrer-Policy":   "no-referrer",
        // Override helmet's strict CSP for this response only.
        // Nonce ties the permission to exactly this script tag.
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

// Get currently logged-in user (used by frontend on load)
router.get("/me", getMe);

// Logout and clear session
router.post("/logout", logout);

export default router;