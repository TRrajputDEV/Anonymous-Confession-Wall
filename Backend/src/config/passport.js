import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import dotenv from "dotenv";

dotenv.config();

const isGoogleOAuthConfigured =
  Boolean(process.env.GOOGLE_CLIENT_ID) &&
  Boolean(process.env.GOOGLE_CLIENT_SECRET) &&
  Boolean(process.env.GOOGLE_CALLBACK_URL);

// Save minimal user info into session
passport.serializeUser((user, done) => {
  console.log("Serializing user:", user);
  done(null, user);
});

// Read user back from session
passport.deserializeUser((user, done) => {
  console.log("Deserializing user:", user);
  done(null, user);
});

if (isGoogleOAuthConfigured) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL,
      },
      (accessToken, refreshToken, profile, done) => {
        console.log("Google profile received:", profile);
        // We only keep what we need — no DB User model needed
        const user = {
          googleId: profile.id,
          displayName: profile.displayName,
          email: profile.emails[0].value,
          avatar: profile.photos[0].value,
        };
        console.log("User object created:", user);
        return done(null, user);
      }
    )
  );
} else {
  console.warn(
    "⚠️ Google OAuth is disabled: set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_CALLBACK_URL to enable it.",
  );
}