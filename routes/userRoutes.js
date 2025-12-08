// routes/userRoutes.js - NEW FILE
import express from "express";
import {
  getAllUsers,
  getUserById,
  updateUserProfile,
  deleteUser
} from "../controllers/userController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// ✅ PROTECTED ROUTES
router.get("/", authMiddleware, getAllUsers); // Get all users
router.get("/:userId", authMiddleware, getUserById); // Get user by ID
router.put("/profile", authMiddleware, updateUserProfile); // Update own profile
router.delete("/:userId", authMiddleware, deleteUser); // Delete user

export default router;
