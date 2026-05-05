import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import dotenv from "dotenv";
import User from "../models/User.model.js";
dotenv.config();

const isGoogleOAuthConfigured =
  Boolean(process.env.GOOGLE_CLIENT_ID) &&
  Boolean(process.env.GOOGLE_CLIENT_SECRET) &&
  Boolean(process.env.GOOGLE_CALLBACK_URL);

// Save minimal user info into session (only googleId stored in session store)
passport.serializeUser((user, done) => {
  done(null, user.googleId);
});

// Rehydrate user from googleId on every request
passport.deserializeUser(async (googleId, done) => {
  try {
    const user = await User.findOne({ googleId }).lean();
    if (!user) return done(null, false);
    return done(null, {
      googleId: user.googleId,
      email: user.email,
      displayName: user.displayName,
      avatar: user.avatar,
    });
  } catch (err) {
    return done(err);
  }
});

if (isGoogleOAuthConfigured) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const googleId = profile.id;
          const email = profile.emails?.[0]?.value;
          const displayName = profile.displayName;
          const avatar = profile.photos?.[0]?.value;

          if (!googleId || !email || !displayName) {
            return done(
              new Error("Google profile is missing required fields."),
            );
          }

          const user = await User.findOneAndUpdate(
            { googleId },
            { $set: { email, displayName, avatar } },
            {
              new: true,
              upsert: true,
              runValidators: true,
              setDefaultsOnInsert: true,
            },
          ).lean();

          return done(null, {
            googleId: user.googleId,
            email: user.email,
            displayName: user.displayName,
            avatar: user.avatar,
          });
        } catch (err) {
          return done(err);
        }
      },
    ),
  );
} else {
  console.warn(
    "⚠️ Google OAuth is disabled: set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_CALLBACK_URL to enable it.",
  );
}