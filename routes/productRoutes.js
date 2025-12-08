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
  searchProducts
} from "../controllers/productController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import uploadMiddleware from "../middleware/uploadMiddleware.js"; // Import the middleware

const router = express.Router();

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
  (req, res, next) => {
    console.log('🛡️ Auth passed, proceeding to upload...');
    next();
  },
  uploadMiddleware, // Use the upload middleware
  (req, res, next) => {
    console.log('✅ Upload complete, proceeding to create product...');
    next();
  },
  createProduct
);

router.put("/:id", authMiddleware, updateProduct);
router.delete("/:id", authMiddleware, deleteProduct);

// ✅ TEST UPLOAD ENDPOINT
router.post("/test-upload",
  uploadMiddleware,
  (req, res) => {
    try {
      console.log('🎯 Test upload successful');
      
      res.json({
        success: true,
        message: `Received ${req.files?.length || 0} files`,
        files: req.files?.map(f => ({
          originalname: f.originalname,
          size: f.size,
          mimetype: f.mimetype,
          fieldname: f.fieldname
        })),
        body: req.body
      });
    } catch (error) {
      console.error('Test upload error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
);

export default router;