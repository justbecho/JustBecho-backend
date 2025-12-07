import express from "express";
import {
  createProduct,
  getUserProducts,
  getProduct,
  updateProduct,
  deleteProduct,
  getAllProducts,
  getProductsByCategory,
  getFeaturedProducts,
  getRecentProducts,
  searchProducts,
  testCloudinary
} from "../controllers/productController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import uploadMiddleware from "../middleware/uploadMiddleware.js";

const router = express.Router();

// ✅ TEST ROUTE (FIRST)
router.get("/test/cloudinary", testCloudinary);

// ✅ PUBLIC ROUTES
router.get("/", getAllProducts); // Get all products
router.get("/search", searchProducts); // Search products
router.get("/featured", getFeaturedProducts); // Featured products
router.get("/recent", getRecentProducts); // Recent products
router.get("/category/:category", getProductsByCategory); // Products by category

// ✅ DYNAMIC ROUTES (MUST BE LAST)
router.get("/:id", getProduct); // Get single product

// ✅ PROTECTED ROUTES (Require Authentication)
router.use(authMiddleware); // All routes below require auth

router.get("/user/my-products", getUserProducts); // User's products
router.post("/", uploadMiddleware, createProduct); // Create product (with image upload)
router.put("/:id", updateProduct); // Update product
router.delete("/:id", deleteProduct); // Delete product

export default router;