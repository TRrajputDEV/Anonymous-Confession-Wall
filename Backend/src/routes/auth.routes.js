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
// redirects via JavaScript. This is critical because:
//
//   - On a 302 redirect, Render's reverse proxy (and some browsers) process
//     the redirect BEFORE storing the Set-Cookie header from this response.
//     The cookie is lost and the session is never established on the client.
//
//   - On a 200 response, the browser fully processes the response — including
//     storing the Set-Cookie header — before the JS runs window.location.replace().
//     By the time the frontend loads and calls /api/auth/me, the cookie exists.
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

      // Sanitize CLIENT_URL to prevent open-redirect injection
      const clientUrl = String(process.env.CLIENT_URL).replace(/"/g, "");

      // Return a 200 page. The browser stores the cookie from this response,
      // THEN the JS redirects — so the cookie is present for all subsequent requests.
      res.status(200).send(`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <title>Logging in…</title>
    <style>
      body {
        margin: 0;
        background: #0d0d0d;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        font-family: sans-serif;
      }
      .spinner {
        width: 32px;
        height: 32px;
        border: 3px solid rgba(255,255,255,0.1);
        border-top-color: #ff3c3c;
        border-radius: 50%;
        animation: spin 0.7s linear infinite;
      }
      @keyframes spin { to { transform: rotate(360deg); } }
    </style>
  </head>
  <body>
    <div class="spinner"></div>
    <script>
      // Cookie is now stored. Navigate to the app.
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