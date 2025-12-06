// routes/productRoutes.js
import express from "express";
import {
  createProduct,
  getUserProducts,
  getProduct,
  updateProduct,
  deleteProduct,
  getAllProducts,
  getProductsByCategory
} from "../controllers/productController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import uploadMiddleware from "../middleware/uploadMiddleware.js";

const router = express.Router();

// ✅ SPECIFIC ROUTES FIRST (FIXED ORDER)
router.get("/my-products", authMiddleware, getUserProducts); // Get user's products - ✅ MUST COME FIRST
router.get("/category/:category", getProductsByCategory); // Get products by category

// ✅ PUBLIC ROUTES
router.get("/", getAllProducts); // Get all products with filters

// ✅ DYNAMIC ROUTES LAST
router.get("/:id", getProduct); // Get single product - ✅ MUST COME LAST

// ✅ PROTECTED ROUTES (Require Authentication)
router.post("/", authMiddleware, uploadMiddleware, createProduct); // Create product
router.put("/:id", authMiddleware, updateProduct); // Update product
router.delete("/:id", authMiddleware, deleteProduct); // Delete product

export default router;
