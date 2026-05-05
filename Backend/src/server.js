import express from "express";
import mongoose from "mongoose";
import session from "express-session";
import passport from "passport";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import MongoStore from "connect-mongo";
dotenv.config();
import "./config/passport.js";
import authRoutes from "./routes/auth.routes.js";
import confessionRoutes from "./routes/confession.routes.js";
import userRoutes from "./routes/user.routes.js";

const app = express();
const PORT = Number(process.env.PORT) || 8000;
const mongoDbName = process.env.MONGO_DB_NAME?.trim();

const requiredEnv = ["MONGO_URI", "SESSION_SECRET", "CLIENT_URL"];
const missingEnv = requiredEnv.filter((key) => !process.env[key]);
if (missingEnv.length > 0) {
  console.error(`❌ Missing required environment variables: ${missingEnv.join(", ")}`);
  process.exit(1);
}

const isProd = process.env.NODE_ENV === "production";

const allowedOrigins = String(process.env.CLIENT_URL)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const cookieSameSite = (
  process.env.COOKIE_SAMESITE || (isProd ? "none" : "lax")
).toLowerCase();

if (!["lax", "strict", "none"].includes(cookieSameSite)) {
  console.error(`❌ Invalid COOKIE_SAMESITE value: ${process.env.COOKIE_SAMESITE}`);
  process.exit(1);
}

// Required for Render, Cloudflare, and any reverse proxy so that
// req.secure is true and secure cookies work correctly.
app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use(helmet({
  hsts: isProd ? { maxAge: 31536000, includeSubDomains: true } : false,
}));

app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
}));

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
}));

app.use(express.json({ limit: "50kb" }));

// CRITICAL FIX for multi-instance deployments (Render free tier runs 4 instances):
//
// resave: true  — forces the session to be saved back to the store on every
//                 request, even if it wasn't modified. Without this, a session
//                 written by Instance A may expire in Instance B's store before
//                 the next request arrives, causing 401s.
//
// saveUninitialized: false — still correct; don't save empty sessions.
//
// The MongoStore is the shared session store across all instances. All four
// Render instances connect to the same MongoDB Atlas collection, so sessions
// created on any instance are readable by all others — but only if resave:true
// ensures they are written on every touch.
//
const sessionStore = MongoStore.create({
  mongoUrl: process.env.MONGO_URI,
  collectionName: "sessions",
  ttl: 14 * 24 * 60 * 60,
  // Automatically remove expired sessions
  autoRemove: "native",
});

sessionStore.on("error", (err) => {
  // Surface MongoStore errors in Render logs — previously these failed silently
  console.error("❌ MongoStore session store error:", err);
});

app.use(session({
  name: process.env.SESSION_COOKIE_NAME || "sid",
  secret: process.env.SESSION_SECRET,
  // resave:true is essential with multiple instances and MongoStore.
  // Without it, the session written during OAuth callback may not persist
  // to the store before the next request from a different instance reads it.
  resave: true,
  saveUninitialized: false,
  proxy: true,
  store: sessionStore,
  cookie: {
    secure: isProd,
    sameSite: cookieSameSite,
    httpOnly: true,
    maxAge: 14 * 24 * 60 * 60 * 1000,
  },
}));

app.use(passport.initialize());
app.use(passport.session());

app.use("/api/auth", authRoutes);
app.use("/api/confessions", confessionRoutes);
app.use("/api/users", userRoutes);

app.use((err, req, res, next) => {
  if (err?.message === "Not allowed by CORS") {
    return res.status(403).json({ message: "CORS: origin not allowed." });
  }
  console.error(err);
  return res.status(500).json({ message: "Server error." });
});

mongoose
  .connect(process.env.MONGO_URI, mongoDbName ? { dbName: mongoDbName } : {})
  .then(() => {
    console.log("✅ MongoDB connected");
    app.listen(PORT, () =>
      console.log(`🚀 Server running → http://localhost:${PORT}`)
    );
  })
  .catch((err) => {
    console.error("❌ DB connection failed:", err.message);
    process.exit(1);
  });