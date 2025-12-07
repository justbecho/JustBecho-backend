import express from "express";
import {
  createProduct,
  getUserProducts,
  getProduct,
  updateProduct,
  deleteProduct,
  getAllProducts,
  getProductsByCategory,
  testCloudinary
} from "../controllers/productController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import uploadMiddleware from "../middleware/uploadMiddleware.js";

const router = express.Router();

// ✅ TEST ROUTE
router.get("/test-cloudinary", testCloudinary);

// ✅ PUBLIC ROUTES
router.get("/", getAllProducts);
router.get("/category/:category", getProductsByCategory);
router.get("/:id", getProduct);

// ✅ PROTECTED ROUTES
router.use(authMiddleware);

router.get("/user/my-products", getUserProducts);
router.post("/", uploadMiddleware, createProduct);
router.put("/:id", updateProduct);
router.delete("/:id", deleteProduct);

export default router;