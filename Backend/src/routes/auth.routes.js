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
// THE FIX: Instead of res.redirect() (302), we return a 200 HTML page that
// redirects via <meta http-equiv="refresh">. This is critical because:
//
//   - On a 302 redirect, Render's reverse proxy processes the redirect BEFORE
//     the browser can store the Set-Cookie header. Cookie is silently lost.
//
//   - On a 200 response, the browser fully processes the response — storing
//     the Set-Cookie — before following the meta-refresh. Cookie exists by the
//     time the frontend loads and calls /api/auth/me.
//
//   - We use <meta refresh> instead of an inline <script> because helmet's
//     Content-Security-Policy blocks inline scripts by default (script-src 'self').
//     Meta refresh is an HTML navigation, not a script — CSP does not block it.
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
        console.error("❌ Session save error after OAuth:", saveErr);
        return res.redirect(
          `${process.env.CLIENT_URL}/login?error=session_failed`,
        );
      }

      // Sanitize CLIENT_URL — strip quotes to prevent header injection
      const clientUrl = String(process.env.CLIENT_URL)
        .replace(/"/g, "")
        .replace(/'/g, "")
        .replace(/</g, "")
        .replace(/>/g, "");

      // 200 response — browser stores the Set-Cookie header here.
      // meta refresh triggers AFTER the response is fully processed.
      // No inline <script> = no CSP violation from helmet.
      res.status(200).send(`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="refresh" content="0; url=${clientUrl}" />
    <title>Logging in…</title>
    <style>
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
      }
      .spinner {
        width: 28px;
        height: 28px;
        border: 2px solid rgba(255,255,255,0.08);
        border-top-color: #ff3c3c;
        border-radius: 50%;
        animation: spin 0.7s linear infinite;
        margin-bottom: 16px;
      }
      @keyframes spin { to { transform: rotate(360deg); } }
      a { color: #ff3c3c; }
    </style>
  </head>
  <body>
    <div class="spinner"></div>
    Redirecting…
    <noscript>
      <p>Click <a href="${clientUrl}">here</a> if not redirected.</p>
    </noscript>
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