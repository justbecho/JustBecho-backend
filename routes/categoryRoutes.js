import express from "express";
import {
  getAllCategories,
  createCategory,
  updateCategory,
  deleteCategory
} from "../controllers/categoryController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// ✅ PUBLIC ROUTE - GET ALL CATEGORIES
router.get("/", getAllCategories);

// ✅ ADMIN ROUTES
router.post("/", authMiddleware, createCategory);
router.put("/:id", authMiddleware, updateCategory);
router.delete("/:id", authMiddleware, deleteCategory);

export default router;