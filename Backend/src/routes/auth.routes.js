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
//   Render's reverse proxy and Cloudflare process the Location header and
//   follow the redirect BEFORE the browser stores Set-Cookie. Cookie lost.
//
// THE FIX — 200 HTML page:
//   Browser fully processes the 200 (stores Set-Cookie), THEN the nonced
//   script runs window.location.replace(). Cookie exists before /api/auth/me.
//
// WHY Cache-Control: no-store + Vary: *:
//   Cloudflare strips Set-Cookie from cached responses.
//   no-store prevents caching. Vary: * makes every response unique so no
//   intermediate cache (browser, CDN, proxy) serves a stale copy.
//   Without this the browser serves the callback from cache (304) and the
//   new nonce never matches — script is blocked and cookie is never set.
//
// WHY a CSP nonce:
//   helmet blocks inline <script> by default (script-src 'self').
//   A per-request nonce overrides that for this one response only.
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

      // Sanitize CLIENT_URL
      const clientUrl = String(process.env.CLIENT_URL).replace(/['"<>]/g, "");

      // Per-request nonce for CSP
      const nonce = crypto.randomBytes(16).toString("base64");

      // ALL of these headers must be set together:
      //
      // Cache-Control: no-store      → don't cache at all (Cloudflare, nginx, browser)
      // Pragma: no-cache             → HTTP/1.0 proxies
      // Surrogate-Control: no-store  → Cloudflare/Fastly surrogate cache
      // Vary: *                      → marks every response as unique; no cache
      //                                will serve a stored copy for any request
      // Expires: 0                   → legacy cache busting
      //
      // Without Vary: * the browser sends a conditional GET (If-None-Match)
      // and gets back 304 Not Modified — serving the OLD cached HTML with the
      // OLD nonce. The new nonce in the CSP header doesn't match → script blocked
      // → window.location.replace never runs → user stuck.
      //
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

// Get currently logged-in user (used by frontend on load)
router.get("/me", getMe);

// Logout and clear session
router.post("/logout", logout);

export default router;