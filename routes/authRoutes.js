import express from "express";
import passport from "passport";
import jwt from "jsonwebtoken";
import { 
  signup, 
  login, 
  getMe, 
  completeProfile, 
  checkProfileStatus,
  convertToSeller,
  updateProfile,
  updateBankDetails,
  getSellerStatus
} from "../controllers/authController.js"; // ✅ Import all controller functions
import authMiddleware from "../middleware/authMiddleware.js";
import User from "../models/User.js";

const router = express.Router();

// ✅ AUTH ROUTES
router.post("/signup", signup);
router.post("/login", login);
router.get("/me", authMiddleware, getMe);
router.post("/complete-profile", authMiddleware, completeProfile);
router.get("/profile-status", authMiddleware, checkProfileStatus);

// ✅ CONVERT BUYER TO SELLER (USING CONTROLLER FUNCTION)
router.put("/convert-to-seller", authMiddleware, convertToSeller);

// ✅ UPDATE PROFILE
router.put("/profile", authMiddleware, updateProfile);

// ✅ UPDATE BANK DETAILS (FOR SELLERS)
router.put("/bank-details", authMiddleware, updateBankDetails);

// ✅ GET SELLER STATUS
router.get("/seller-status", authMiddleware, getSellerStatus);

// ✅ QUICK PROFILE CHECK
router.get('/profile/check', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Clean username helper function
    const cleanUsername = (username) => {
      if (!username) return null;
      
      let clean = username
        .replace(/@justbecho/gi, '')  // Remove @justbecho
        .replace(/@@/g, '@')          // Fix double @@
        .replace(/^@+/, '@');         // Ensure starts with single @
      
      if (!clean.startsWith('@')) {
        clean = '@' + clean;
      }
      
      return clean;
    };

    const cleanedUsername = cleanUsername(user.username);

    res.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        profileCompleted: user.profileCompleted,
        phone: user.phone,
        address: user.address,
        instaId: user.instaId,
        sellerVerified: user.sellerVerified,
        sellerVerificationStatus: user.sellerVerificationStatus,
        verificationId: user.verificationId,
        username: cleanedUsername, // ✅ Send cleaned username
        bankDetails: user.bankDetails
      },
      requiresProfile: !user.profileCompleted
    });
  } catch (error) {
    console.error('Profile check error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// ✅ SINGLE DASHBOARD FOR ALL ROLES
router.get("/dashboard", authMiddleware, (req, res) => {
  try {
    const user = req.user;
    
    // Clean username helper function
    const cleanUsername = (username) => {
      if (!username) return null;
      
      let clean = username
        .replace(/@justbecho/gi, '')  // Remove @justbecho
        .replace(/@@/g, '@')          // Fix double @@
        .replace(/^@+/, '@');         // Ensure starts with single @
      
      if (!clean.startsWith('@')) {
        clean = '@' + clean;
      }
      
      return clean;
    };

    const cleanedUsername = cleanUsername(user.username);

    // Common dashboard data for all roles
    const dashboardData = {
      success: true,
      message: `Welcome to Dashboard, ${user.name || user.email}`,
      user: {
        ...user,
        username: cleanedUsername // ✅ Send cleaned username
      },
      commonFeatures: [
        'Profile Management',
        'Browse Products',
        'Wishlist',
        'Orders'
      ]
    };

    // Role-specific features add karo
    if (user.role === 'seller') {
      dashboardData.sellerFeatures = [
        'Add Products',
        'Manage Listings',
        'View Sales',
        'Track Earnings'
      ];
      dashboardData.sellerVerified = user.sellerVerified;
      dashboardData.username = cleanedUsername; // ✅ Clean username
    } else if (user.role === 'influencer') {
      dashboardData.influencerFeatures = [
        'View Campaigns',
        'Collaborate with Brands',
        'Track Performance'
      ];
      dashboardData.instaId = user.instaId;
    }

    res.json(dashboardData);
  } catch (error) {
    console.error('❌ Dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error in dashboard'
    });
  }
});

// ✅ UPDATE PROFILE FOR ALL USERS (DEPRECATED - USE /profile INSTEAD)
router.put("/profile/update", authMiddleware, async (req, res) => {
  try {
    const { name, phone, address } = req.body;
    const userId = req.user.userId;

    const updateData = {};
    if (name) updateData.name = name;
    if (phone) updateData.phone = phone;
    if (address) updateData.address = address;

    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true }
    ).select('-password');

    // Clean username helper function
    const cleanUsername = (username) => {
      if (!username) return null;
      
      let clean = username
        .replace(/@justbecho/gi, '')  // Remove @justbecho
        .replace(/@@/g, '@')          // Fix double @@
        .replace(/^@+/, '@');         // Ensure starts with single @
      
      if (!clean.startsWith('@')) {
        clean = '@' + clean;
      }
      
      return clean;
    };

    const cleanedUsername = cleanUsername(user.username);

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        address: user.address,
        role: user.role,
        username: cleanedUsername, // ✅ Send cleaned username
        profileCompleted: user.profileCompleted,
        sellerVerified: user.sellerVerified
      }
    });

  } catch (error) {
    console.error('❌ Profile update error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating profile'
    });
  }
});

// ✅ FIXED GOOGLE AUTH ROUTES
router.get("/google", passport.authenticate("google", { 
  scope: ["email", "profile"] 
}));

router.get(
  "/google/callback",
  passport.authenticate("google", { 
    session: false,
    failureRedirect: "http://localhost:3000/auth/error?message=auth_failed" 
  }),
  async (req, res) => {
    try {
      const user = req.user;
      console.log('✅ Google auth successful for:', user.email);

      await User.findByIdAndUpdate(user._id, { 
        lastLogin: new Date() 
      });

      const tokenPayload = {
        userId: user._id.toString(),
        email: user.email
      };

      const token = jwt.sign(
        tokenPayload,
        process.env.JWT_SECRET, 
        { expiresIn: "7d" }
      );

      console.log('📋 User profile completed:', user.profileCompleted);
      console.log('🎭 User role:', user.role);
      console.log('👤 Username:', user.username);

      // Clean username before redirecting
      const cleanUsername = (username) => {
        if (!username) return null;
        
        let clean = username
          .replace(/@justbecho/gi, '')  // Remove @justbecho
          .replace(/@@/g, '@')          // Fix double @@
          .replace(/^@+/, '@');         // Ensure starts with single @
        
        if (!clean.startsWith('@')) {
          clean = '@' + clean;
        }
        
        return clean;
      };

      const cleanedUsername = cleanUsername(user.username);

      // Agar profile complete nahi hai toh complete-profile pe redirect karo
      let redirectUrl = `http://localhost:3000/?token=${token}`;
      
      if (!user.profileCompleted) {
        redirectUrl = `http://localhost:3000/complete-profile?token=${token}`;
        console.log('🔄 Redirecting to complete profile');
      } else {
        console.log('🚀 Redirecting to home page');
      }
      
      // Add username to URL if exists
      if (cleanedUsername) {
        redirectUrl += `&username=${encodeURIComponent(cleanedUsername)}`;
      }
      
      res.redirect(redirectUrl);
      
    } catch (error) {
      console.error('❌ Google auth callback error:', error);
      res.redirect('http://localhost:3000/auth/error?message=server_error');
    }
  }
);

// ✅ GET GOOGLE USER DATA
router.get("/google/user", authMiddleware, async (req, res) => {
  try {
    console.log('🎯 Fetching Google user data for user:', req.user);
    
    const userId = req.user.userId;
    
    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        message: 'User ID not found in token' 
      });
    }

    console.log('🔍 Looking for user with ID:', userId);
    
    const user = await User.findById(userId).select('-password');
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    console.log('✅ User found:', user.email);
    console.log('📋 Profile completed:', user.profileCompleted);
    console.log('🎭 User role:', user.role);
    console.log('👤 Original username:', user.username);

    // Clean username helper function
    const cleanUsername = (username) => {
      if (!username) return null;
      
      let clean = username
        .replace(/@justbecho/gi, '')  // Remove @justbecho
        .replace(/@@/g, '@')          // Fix double @@
        .replace(/^@+/, '@');         // Ensure starts with single @
      
      if (!clean.startsWith('@')) {
        clean = '@' + clean;
      }
      
      return clean;
    };

    const cleanedUsername = cleanUsername(user.username);
    console.log('👤 Cleaned username:', cleanedUsername);
    
    res.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        name: user.name || user.email.split('@')[0],
        username: cleanedUsername, // ✅ Send cleaned username
        role: user.role,
        profileCompleted: user.profileCompleted,
        instaId: user.instaId,
        sellerVerified: user.sellerVerified,
        sellerVerificationStatus: user.sellerVerificationStatus,
        phone: user.phone,
        address: user.address,
        bankDetails: user.bankDetails
      }
    });
  } catch (error) {
    console.error('❌ Google user data error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while fetching user data' 
    });
  }
});

// ✅ CHECK USERNAME AVAILABILITY
router.get("/check-username/:username", async (req, res) => {
  try {
    const { username } = req.params;
    
    if (!username) {
      return res.status(400).json({
        success: false,
        message: 'Username is required'
      });
    }

    // Remove @ prefix for search
    const searchUsername = username.replace(/^@+/, '');
    
    // Check if username exists
    const existingUser = await User.findOne({ 
      username: { $regex: new RegExp(`^${searchUsername}$`, 'i') }
    });

    res.json({
      success: true,
      available: !existingUser,
      username: searchUsername
    });
    
  } catch (error) {
    console.error('❌ Check username error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while checking username'
    });
  }
});

// ✅ GET ALL SELLERS (ADMIN ONLY)
router.get("/sellers", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    
    if (user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.'
      });
    }

    const sellers = await User.find({ role: 'seller' }).select('-password');
    
    // Clean usernames
    const cleanedSellers = sellers.map(seller => {
      const cleanUsername = (username) => {
        if (!username) return null;
        
        let clean = username
          .replace(/@justbecho/gi, '')
          .replace(/@@/g, '@')
          .replace(/^@+/, '@');
        
        if (!clean.startsWith('@')) {
          clean = '@' + clean;
        }
        
        return clean;
      };

      return {
        ...seller.toObject(),
        username: cleanUsername(seller.username)
      };
    });

    res.json({
      success: true,
      count: cleanedSellers.length,
      sellers: cleanedSellers
    });
    
  } catch (error) {
    console.error('❌ Get sellers error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching sellers'
    });
  }
});

// ✅ VERIFY SELLER (ADMIN ONLY)
router.put("/verify-seller/:userId", authMiddleware, async (req, res) => {
  try {
    const adminUser = await User.findById(req.user.userId);
    
    if (adminUser.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.'
      });
    }

    const { userId } = req.params;
    const { status, username } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Use "approved" or "rejected".'
      });
    }

    const seller = await User.findById(userId);
    
    if (!seller) {
      return res.status(404).json({
        success: false,
        message: 'Seller not found'
      });
    }

    if (seller.role !== 'seller') {
      return res.status(400).json({
        success: false,
        message: 'User is not a seller'
      });
    }

    // Update seller status
    seller.sellerVerificationStatus = status;
    seller.sellerVerified = status === 'approved';
    
    // Update username if provided
    if (username && status === 'approved') {
      const cleanUsername = username.replace(/^@+/, '').replace(/@justbecho/gi, '');
      seller.username = cleanUsername;
    }

    await seller.save();

    // Clean username for response
    const cleanResponseUsername = (username) => {
      if (!username) return null;
      
      let clean = username
        .replace(/@justbecho/gi, '')
        .replace(/@@/g, '@')
        .replace(/^@+/, '@');
      
      if (!clean.startsWith('@')) {
        clean = '@' + clean;
      }
      
      return clean;
    };

    res.json({
      success: true,
      message: `Seller ${status} successfully`,
      seller: {
        id: seller._id,
        email: seller.email,
        name: seller.name,
        username: cleanResponseUsername(seller.username),
        sellerVerified: seller.sellerVerified,
        sellerVerificationStatus: seller.sellerVerificationStatus
      }
    });
    
  } catch (error) {
    console.error('❌ Verify seller error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while verifying seller'
    });
  }
});

export default router;
