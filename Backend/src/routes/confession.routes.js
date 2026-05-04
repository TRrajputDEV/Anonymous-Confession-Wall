import express from "express";
import {
  createConfession, getAllConfessions, updateConfession,
  deleteConfession, reactToConfession, getPredefinedTags,
} from "../controllers/confession.controller.js";

import {
  getComments, addComment, updateComment, deleteComment
} from "../controllers/comment.controller.js";

import { isAuthenticated } from "../middleware/auth.middleware.js";

const router = express.Router();

// ── Public Routes ──
router.get("/", getAllConfessions);
router.get("/tags/predefined", getPredefinedTags);
router.get("/:id/comments", getComments); 

// ── Protected Routes ──
router.post("/", isAuthenticated, createConfession);
router.put("/:id", isAuthenticated, updateConfession);
router.delete("/:id", isAuthenticated, deleteConfession);
router.post("/:id/react", isAuthenticated, reactToConfession);

// ── Protected Comment Routes ──
router.post("/:id/comments", isAuthenticated, addComment);
router.put("/:id/comments/:commentId", isAuthenticated, updateComment);    // NEW
router.delete("/:id/comments/:commentId", isAuthenticated, deleteComment); // NEW

export default router;