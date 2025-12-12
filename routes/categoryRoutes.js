import express from "express";
import {
  getAllCategories,
  getCategoryBySlug,
  getCategoryProducts,
  createCategory,
  updateCategory,
  deleteCategory,
  getCategoriesForNav,
  searchCategories,
  getCategoryStats
} from "../controllers/categoryController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// ✅ PUBLIC ROUTES
router.get("/", getAllCategories); // Get all categories
router.get("/nav", getCategoriesForNav); // Get categories for navigation
router.get("/search", searchCategories); // Search categories
router.get("/stats", getCategoryStats); // Get category statistics
router.get("/:slug", getCategoryBySlug); // Get category by slug
router.get("/:slug/products", getCategoryProducts); // Get products by category slug

// ✅ PROTECTED ROUTES (Admin only)
router.post("/", authMiddleware, createCategory);
router.put("/:categoryId", authMiddleware, updateCategory);
router.delete("/:categoryId", authMiddleware, deleteCategory);

export default router;