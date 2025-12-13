import express from "express";
import {
  createProduct,
  getUserProducts,
  getProduct,
  updateProduct,
  deleteProduct,
  getAllProducts,
  getProductsByCategory,
  getProductsByBrand,
  getAllBrands,
  getFeaturedProducts,
  searchProducts,
  testCloudinary
} from "../controllers/productController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import uploadMiddleware from "../middleware/uploadMiddleware.js";

const router = express.Router();

// ✅ TEST ENDPOINT
router.get("/test/cloudinary", testCloudinary);

// ✅ BRAND ROUTES
router.get("/brands/all", getAllBrands);
router.get("/brand/:brand", getProductsByBrand);

// ✅ CATEGORY ROUTE - MUST COME BEFORE GENERIC ROUTES
router.get("/category/:category", getProductsByCategory);

// ✅ OTHER PUBLIC ROUTES
router.get("/featured", getFeaturedProducts);
router.get("/search", searchProducts);

// ✅ PUBLIC ROUTES (Keep at bottom to avoid conflict)
router.get("/", getAllProducts);
router.get("/:id", getProduct);

// ============================================
// ✅ PROTECTED ROUTES - REQUIRE AUTHENTICATION
// ============================================

// ✅ USER: Get my products (authenticated users only)
router.get("/my-products", authMiddleware, getUserProducts);

// ✅ USER: Create new product (authenticated users only)
router.post("/", 
  authMiddleware,
  uploadMiddleware,
  createProduct
);

// ✅ USER/ADMIN: Update product
// User can update own product, Admin can update any product
router.put("/:id", authMiddleware, updateProduct);

// ✅ USER/ADMIN: Delete product  
// User can delete own product, Admin can delete any product
router.delete("/:id", authMiddleware, deleteProduct);

export default router;