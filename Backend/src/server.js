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

// Routes
import authRoutes from "./routes/auth.routes.js";
import confessionRoutes from "./routes/confession.routes.js";
import userRoutes from "./routes/user.routes.js";
const app = express();

const PORT = Number(process.env.PORT) || 8000;
const mongoDbName = process.env.MONGO_DB_NAME?.trim();

const requiredEnv = ["MONGO_URI", "SESSION_SECRET", "CLIENT_URL"];
const missingEnv = requiredEnv.filter((key) => !process.env[key]);
if (missingEnv.length > 0) {
  console.error(
    `❌ Missing required environment variables: ${missingEnv.join(", ")}`,
  );
  process.exit(1);
}

const isProd = process.env.NODE_ENV === "production";
const allowedOrigins = String(process.env.CLIENT_URL)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const cookieSameSite = (process.env.COOKIE_SAMESITE || (isProd ? "lax" : "lax"))
  .toLowerCase();
if (!(["lax", "strict", "none"].includes(cookieSameSite))) {
  console.error(
    `❌ Invalid COOKIE_SAMESITE value: ${process.env.COOKIE_SAMESITE}. Use lax|strict|none.`,
  );
  process.exit(1);
}
if (cookieSameSite === "none" && !isProd) {
  console.warn(
    "⚠️ COOKIE_SAMESITE=none is intended for HTTPS production deployments.",
  );
}

// Required when running behind a reverse proxy (nginx, load balancer) so
// secure cookies and req.secure work correctly.
app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use(
  helmet({
    hsts: isProd
      ? { maxAge: 31536000, includeSubDomains: true }
      : false,
  }),
);
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow same-origin / server-to-server requests (no Origin header)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true, // allow cookies from frontend
  }),
);

app.use(express.json({ limit: "50kb" }));

app.use(
  session({
    name: process.env.SESSION_COOKIE_NAME || "sid",
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    proxy: isProd,
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI,
      collectionName: "sessions",
      ttl: 14 * 24 * 60 * 60,
    }),
    cookie: {
      secure: isProd,
      sameSite: cookieSameSite,
      httpOnly: true,
      maxAge: 14 * 24 * 60 * 60 * 1000,
    },
  }),
);

app.use(passport.initialize());
app.use(passport.session());

app.use("/api/auth", authRoutes);
app.use("/api/confessions", confessionRoutes);
app.use("/api/users", userRoutes);

// Basic error handler (avoids leaking stack traces by default)
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
      console.log(`🚀 Server running → http://localhost:${PORT}`),
    );
  })
  .catch((err) => {
    console.error("❌ DB connection failed:", err.message);
    process.exit(1);
  });
