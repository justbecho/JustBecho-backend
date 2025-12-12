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
  testCloudinary,
  getAllCategoriesDebug,
  checkCategoryMatch
} from "../controllers/productController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import uploadMiddleware from "../middleware/uploadMiddleware.js";

const router = express.Router();

// ✅ DEBUG ENDPOINTS
router.get("/debug/categories", getAllCategoriesDebug);
router.get("/debug/category-match/:category", checkCategoryMatch);
router.get("/test/cloudinary", testCloudinary);

// ✅ BRAND ROUTES
router.get("/brands/all", getAllBrands);
router.get("/brand/:brand", getProductsByBrand);

// ✅ SPECIFIC ROUTES FIRST
router.get("/my-products", authMiddleware, getUserProducts);
router.get("/featured", getFeaturedProducts);
router.get("/search", searchProducts);
router.get("/category/:category", getProductsByCategory); // ✅ PERMANENT FIX APPLIED

// ✅ PUBLIC ROUTES
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