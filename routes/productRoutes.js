// routes/productRoutes.js - UPDATED VERSION
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
  searchProducts,
  testCloudinary
} from "../controllers/productController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import uploadMiddleware from "../middleware/uploadMiddleware.js";

const router = express.Router();

// ✅ TEST ENDPOINTS
router.get("/test/cloudinary", testCloudinary);

// ✅ SPECIFIC ROUTES FIRST
router.get("/my-products", authMiddleware, getUserProducts);
router.get("/featured", getFeaturedProducts);
router.get("/search", searchProducts);
router.get("/category/:category", getProductsByCategory);

// ✅ PUBLIC ROUTES
router.get("/", getAllProducts);

// ✅ DYNAMIC ROUTES LAST
router.get("/:id", getProduct);

// ✅ PROTECTED ROUTES
router.post("/", 
  authMiddleware,
  uploadMiddleware,
  createProduct
);

router.put("/:id", authMiddleware, updateProduct);
router.delete("/:id", authMiddleware, deleteProduct);

// ✅ DEBUG ENDPOINT
router.post("/debug", 
  uploadMiddleware,
  (req, res) => {
    try {
      res.json({
        success: true,
        message: 'Debug endpoint',
        hasBody: !!req.body,
        hasFiles: !!req.files,
        bodyKeys: req.body ? Object.keys(req.body) : [],
        filesCount: req.files ? req.files.length : 0,
        files: req.files ? req.files.map(f => ({
          name: f.originalname,
          size: f.size,
          mimetype: f.mimetype
        })) : [],
        headers: {
          'content-type': req.headers['content-type'],
          'content-length': req.headers['content-length']
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
);

export default router;