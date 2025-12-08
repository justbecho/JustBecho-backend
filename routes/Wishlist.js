import express from "express";
import Wishlist from "../models/Wishlist.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// ✅ ADD TO WISHLIST - FIXED
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { productId } = req.body;
    const userId = req.user.userId;

    console.log('🎯 Add to wishlist request:', { userId, productId });

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "Product ID is required"
      });
    }

    // Find or create wishlist
    let wishlist = await Wishlist.findOne({ user: userId });

    if (!wishlist) {
      wishlist = new Wishlist({
        user: userId,
        products: [productId] // ✅ Direct productId, not object
      });
    } else {
      // Check if product already exists
      if (wishlist.products.includes(productId)) {
        return res.status(400).json({
          success: false,
          message: "Product already in wishlist"
        });
      }
      // Add product to array
      wishlist.products.push(productId);
    }

    await wishlist.save();

    // Populate products with details
    const populatedWishlist = await Wishlist.findById(wishlist._id)
      .populate('products', 'productName brand finalPrice images condition');

    res.status(200).json({
      success: true,
      message: "Product added to wishlist successfully",
      wishlist: populatedWishlist
    });

  } catch (error) {
    console.error('❌ Add to wishlist error:', error);
    res.status(500).json({
      success: false,
      message: "Server error: " + error.message
    });
  }
});

// ✅ GET USER'S WISHLIST - FIXED
router.get("/", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;

    console.log('🎯 Get wishlist request for user:', userId);

    const wishlist = await Wishlist.findOne({ user: userId })
      .populate('products', 'productName brand finalPrice images condition category');

    if (!wishlist) {
      return res.status(200).json({
        success: true,
        message: "Wishlist is empty",
        products: [] // ✅ Direct products array return karo
      });
    }

    res.status(200).json({
      success: true,
      products: wishlist.products // ✅ Direct products array
    });

  } catch (error) {
    console.error('❌ Get wishlist error:', error);
    res.status(500).json({
      success: false,
      message: "Server error: " + error.message
    });
  }
});

// ✅ REMOVE FROM WISHLIST - FIXED
router.delete("/:productId", authMiddleware, async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user.userId;

    console.log('🎯 Remove from wishlist request:', { userId, productId });

    const wishlist = await Wishlist.findOne({ user: userId });

    if (!wishlist) {
      return res.status(404).json({
        success: false,
        message: "Wishlist not found"
      });
    }

    // Remove product from array
    wishlist.products = wishlist.products.filter(
      product => product.toString() !== productId
    );

    await wishlist.save();

    // Populate updated wishlist
    const populatedWishlist = await Wishlist.findById(wishlist._id)
      .populate('products', 'productName brand finalPrice images condition');

    res.status(200).json({
      success: true,
      message: "Product removed from wishlist successfully",
      products: populatedWishlist.products // ✅ Direct products array
    });

  } catch (error) {
    console.error('❌ Remove from wishlist error:', error);
    res.status(500).json({
      success: false,
      message: "Server error: " + error.message
    });
  }
});

// ✅ CHECK IF PRODUCT IS IN WISHLIST - FIXED
router.get("/check/:productId", authMiddleware, async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user.userId;

    const wishlist = await Wishlist.findOne({ user: userId });

    if (!wishlist) {
      return res.status(200).json({
        success: true,
        isInWishlist: false
      });
    }

    const isInWishlist = wishlist.products.some(
      product => product.toString() === productId
    );

    res.status(200).json({
      success: true,
      isInWishlist
    });

  } catch (error) {
    console.error('❌ Check wishlist error:', error);
    res.status(500).json({
      success: false,
      message: "Server error: " + error.message
    });
  }
});

export default router;
