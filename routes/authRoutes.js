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
} from "../controllers/authController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import User from "../models/User.js";

const router = express.Router();

// ✅ Environment-based URLs
const isProduction = process.env.NODE_ENV === 'production';
const FRONTEND_URL = process.env.FRONTEND_URL || 
  (isProduction ? 'https://just-becho-frontend.vercel.app' : 'http://localhost:3000');
const BACKEND_URL = process.env.BACKEND_URL ||
  (isProduction ? 'https://just-becho-backend.vercel.app' : 'http://localhost:5000');

console.log('🌐 Environment Configuration:');
console.log('   Production:', isProduction);
console.log('   Frontend URL:', FRONTEND_URL);
console.log('   Backend URL:', BACKEND_URL);

// ✅ AUTH ROUTES
router.post("/signup", signup);
router.post("/login", login);
router.get("/me", authMiddleware, getMe);
router.post("/complete-profile", authMiddleware, completeProfile);
router.get("/profile-status", authMiddleware, checkProfileStatus);

// ✅ CONVERT BUYER TO SELLER
router.put("/convert-to-seller", authMiddleware, convertToSeller);

// ✅ UPDATE PROFILE
router.put("/profile", authMiddleware, updateProfile);

// ✅ UPDATE BANK DETAILS
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
        username: cleanedUsername,
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

    const cleanedUsername = cleanUsername(user.username);

    const dashboardData = {
      success: true,
      message: `Welcome to Dashboard, ${user.name || user.email}`,
      user: {
        ...user,
        username: cleanedUsername
      },
      commonFeatures: [
        'Profile Management',
        'Browse Products',
        'Wishlist',
        'Orders'
      ]
    };

    if (user.role === 'seller') {
      dashboardData.sellerFeatures = [
        'Add Products',
        'Manage Listings',
        'View Sales',
        'Track Earnings'
      ];
      dashboardData.sellerVerified = user.sellerVerified;
      dashboardData.username = cleanedUsername;
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

// ✅ UPDATE PROFILE FOR ALL USERS
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
        username: cleanedUsername,
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

// ✅ GOOGLE AUTH DEBUG ROUTE
router.get('/google/debug', (req, res) => {
  res.json({
    clientId: process.env.GOOGLE_CLIENT_ID ? '✅ Set' : '❌ Missing',
    callbackUrl: process.env.GOOGLE_CALLBACK_URL || '❌ Not set',
    frontendUrl: FRONTEND_URL,
    backendUrl: BACKEND_URL,
    environment: process.env.NODE_ENV || 'development',
    googleAuthUrl: `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.GOOGLE_CALLBACK_URL || '')}&response_type=code&scope=email%20profile&access_type=offline&prompt=consent`
  });
});

// ✅ GOOGLE AUTH ROUTES - FIXED FOR VERCEL
router.get("/google", 
  (req, res, next) => {
    console.log('🔍 Google OAuth Initiated');
    console.log('   Request from:', req.get('origin'));
    console.log('   Client ID:', process.env.GOOGLE_CLIENT_ID ? '✅ Set' : '❌ Missing');
    console.log('   Callback URL:', process.env.GOOGLE_CALLBACK_URL || 'Not set');
    console.log('   Frontend URL:', FRONTEND_URL);
    next();
  },
  passport.authenticate("google", { 
    scope: ["email", "profile"],
    accessType: 'offline',
    prompt: 'consent'
  })
);

// ✅ GOOGLE CALLBACK - FIXED REDIRECTS
router.get(
  "/google/callback",
  (req, res, next) => {
    console.log('🔄 Google Callback Hit');
    console.log('   Query params:', req.query);
    console.log('   Code received:', req.query.code ? '✅ Yes' : '❌ No');
    console.log('   Error:', req.query.error || 'None');
    console.log('   State:', req.query.state || 'None');
    next();
  },
  passport.authenticate("google", { 
    session: false,
    failureRedirect: `${FRONTEND_URL}/auth/error?message=auth_failed`
  }),
  async (req, res) => {
    try {
      const user = req.user;
      console.log('✅ Google auth successful for:', user.email);
      console.log('   Profile completed:', user.profileCompleted);
      console.log('   User role:', user.role);
      console.log('   Username:', user.username);

      // Update last login
      await User.findByIdAndUpdate(user._id, { 
        lastLogin: new Date() 
      });

      // Generate JWT token
      const tokenPayload = {
        userId: user._id.toString(),
        email: user.email
      };

      const token = jwt.sign(
        tokenPayload,
        process.env.JWT_SECRET, 
        { expiresIn: "7d" }
      );

      // Clean username
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

      const cleanedUsername = cleanUsername(user.username);

      // Determine redirect URL
      let redirectUrl = `${FRONTEND_URL}/`;
      
      if (!user.profileCompleted) {
        redirectUrl = `${FRONTEND_URL}/complete-profile`;
        console.log('🔄 Redirecting to complete profile');
      } else {
        console.log('🚀 Redirecting to home page');
      }
      
      // Add token and username to URL
      redirectUrl += `?token=${token}`;
      
      if (cleanedUsername) {
        redirectUrl += `&username=${encodeURIComponent(cleanedUsername)}`;
      }
      
      console.log('   Final redirect URL:', redirectUrl);
      res.redirect(redirectUrl);
      
    } catch (error) {
      console.error('❌ Google auth callback error:', error);
      res.redirect(`${FRONTEND_URL}/auth/error?message=server_error`);
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

    // Clean username
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

    const cleanedUsername = cleanUsername(user.username);
    
    res.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        name: user.name || user.email.split('@')[0],
        username: cleanedUsername,
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