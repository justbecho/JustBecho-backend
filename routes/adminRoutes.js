import express from "express";
import adminMiddleware from "../middleware/adminMiddleware.js";
import authMiddleware from "../middleware/authMiddleware.js";
import Product from "../models/Product.js";
import User from "../models/User.js";

const router = express.Router();

// ✅ ALL ROUTES REQUIRE ADMIN ACCESS
router.use(authMiddleware, adminMiddleware);

// 👑 GET ALL USERS (Admin only)
router.get("/users", async (req, res) => {
  try {
    const users = await User.find().select('-password');
    
    res.json({
      success: true,
      count: users.length,
      users
    });
  } catch (error) {
    console.error('Admin get users error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 👑 GET ALL PRODUCTS (Admin only)
router.get("/products", async (req, res) => {
  try {
    const products = await Product.find()
      .sort({ createdAt: -1 })
      .populate('seller', 'name email phone');
    
    res.json({
      success: true,
      count: products.length,
      products
    });
  } catch (error) {
    console.error('Admin get products error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 👑 DELETE ANY PRODUCT (Admin only)
router.delete("/products/:productId", async (req, res) => {
  try {
    const product = await Product.findById(req.params.productId);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    await Product.findByIdAndDelete(req.params.productId);
    
    res.json({
      success: true,
      message: 'Product deleted by admin'
    });
  } catch (error) {
    console.error('Admin delete product error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 👑 DELETE ANY USER (Admin only)
router.delete("/users/:userId", async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Prevent deleting yourself
    if (user._id.toString() === req.user.userId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete yourself'
      });
    }
    
    await User.findByIdAndDelete(req.params.userId);
    
    res.json({
      success: true,
      message: 'User deleted by admin'
    });
  } catch (error) {
    console.error('Admin delete user error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 👑 UPDATE USER ROLE (Admin only)
router.patch("/users/:userId/role", async (req, res) => {
  try {
    const { role } = req.body;
    
    if (!['user', 'buyer', 'seller', 'influencer', 'admin'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role'
      });
    }
    
    const user = await User.findById(req.params.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    user.role = role;
    await user.save();
    
    res.json({
      success: true,
      message: `User role updated to ${role}`,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Admin update role error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 👑 VERIFY SELLER (Admin only)
router.patch("/sellers/:userId/verify", async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    if (user.role !== 'seller') {
      return res.status(400).json({
        success: false,
        message: 'User is not a seller'
      });
    }
    
    user.sellerVerified = true;
    user.sellerVerificationStatus = 'approved';
    user.verifiedAt = new Date();
    await user.save();
    
    res.json({
      success: true,
      message: 'Seller verified successfully',
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        sellerVerified: user.sellerVerified,
        sellerVerificationStatus: user.sellerVerificationStatus
      }
    });
  } catch (error) {
    console.error('Admin verify seller error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 👑 ADMIN DASHBOARD STATS
router.get("/stats", async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalSellers = await User.countDocuments({ role: 'seller' });
    const verifiedSellers = await User.countDocuments({ 
      role: 'seller', 
      sellerVerified: true 
    });
    const totalProducts = await Product.countDocuments();
    const activeProducts = await Product.countDocuments({ status: 'active' });
    
    res.json({
      success: true,
      stats: {
        totalUsers,
        totalSellers,
        verifiedSellers,
        pendingSellers: totalSellers - verifiedSellers,
        totalProducts,
        activeProducts,
        soldProducts: totalProducts - activeProducts
      }
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;