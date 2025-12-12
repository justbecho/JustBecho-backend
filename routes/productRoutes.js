import express from "express";
import {
  createProduct,
  getUserProducts,
  getProduct,
  updateProduct,
  deleteProduct,
  getAllProducts,
  getProductsByCategory, // ✅ Updated function
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
router.get("/category/:category", getProductsByCategory); // ✅ PERMANENT FIX

// ✅ OTHER ROUTES
router.get("/my-products", authMiddleware, getUserProducts);
router.get("/featured", getFeaturedProducts);
router.get("/search", searchProducts);

// ✅ PUBLIC ROUTES (Keep at bottom to avoid conflict)
router.get("/", getAllProducts);
router.get("/:id", getProduct);

// ✅ PROTECTED ROUTES
router.post("/", 
  authMiddleware,
  uploadMiddleware,
  createProduct
);

router.put("/:id", authMiddleware, updateProduct);
router.delete("/:id", authMiddleware, deleteProduct);

export default router;