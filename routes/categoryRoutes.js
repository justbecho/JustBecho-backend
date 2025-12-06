// routes/categoryRoutes.js - NEW FILE
import express from "express";
import {
  getAllCategories,
  createCategory,
  updateCategory,
  deleteCategory
} from "../controllers/categoryController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// ✅ PUBLIC ROUTES
router.get("/", getAllCategories); // Get all categories

// ✅ PROTECTED ROUTES (Admin only - add admin check later)
router.post("/", authMiddleware, createCategory); // Create category
router.put("/:categoryId", authMiddleware, updateCategory); // Update category
router.delete("/:categoryId", authMiddleware, deleteCategory); // Delete category

export default router;