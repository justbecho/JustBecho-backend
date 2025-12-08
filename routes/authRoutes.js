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

// ✅ HARDCODED FOR PRODUCTION - CHANGE THESE!
const PRODUCTION_CONFIG = {
  clientId: '711574038874-r069ib4ureqbir5sukg69at13hspa9a8.apps.googleusercontent.com',
  redirectUri: 'https://just-becho-backend.vercel.app/api/auth/google/callback',
  frontendUrl: 'https://just-becho-frontend.vercel.app'
};

console.log('🚀 Google OAuth Configuration:');
console.log('   Client ID:', PRODUCTION_CONFIG.clientId);
console.log('   Redirect URI:', PRODUCTION_CONFIG.redirectUri);
console.log('   Frontend URL:', PRODUCTION_CONFIG.frontendUrl);

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
  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${PRODUCTION_CONFIG.clientId}&` +
    `redirect_uri=${encodeURIComponent(PRODUCTION_CONFIG.redirectUri)}&` +
    `response_type=code&` +
    `scope=profile%20email&` +
    `access_type=offline&` +
    `prompt=consent`;
  
  res.json({
    success: true,
    config: PRODUCTION_CONFIG,
    googleAuthUrl: googleAuthUrl,
    testInstructions: 'Copy googleAuthUrl and paste in browser'
  });
});

// ✅ SIMPLE GOOGLE AUTH ROUTE (NO PASSPORT)
router.get("/google", (req, res) => {
  console.log('🚀 Google OAuth initiated');
  
  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${PRODUCTION_CONFIG.clientId}&` +
    `redirect_uri=${encodeURIComponent(PRODUCTION_CONFIG.redirectUri)}&` +
    `response_type=code&` +
    `scope=profile%20email&` +
    `access_type=offline&` +
    `prompt=consent&` +
    `state=justbecho_${Date.now()}`;
  
  console.log('Redirecting to:', googleAuthUrl);
  res.redirect(googleAuthUrl);
});

// ✅ GOOGLE CALLBACK ROUTE
router.get("/google/callback", async (req, res) => {
  try {
    console.log('🔄 Google Callback Received');
    console.log('Query params:', req.query);
    
    const { code, error } = req.query;
    
    if (error) {
      console.error('❌ Google OAuth error:', error);
      return res.redirect(`${PRODUCTION_CONFIG.frontendUrl}/login?error=google_auth_failed`);
    }
    
    if (!code) {
      console.error('❌ No authorization code received');
      return res.redirect(`${PRODUCTION_CONFIG.frontendUrl}/login?error=no_auth_code`);
    }
    
    // Exchange code for tokens
    console.log('🔄 Exchanging code for tokens...');
    
    // You need to implement token exchange here
    // For now, we'll create a mock user
    const mockUser = {
      _id: 'mock_id_' + Date.now(),
      email: 'test@example.com',
      name: 'Google User',
      profileCompleted: false,
      role: 'user'
    };
    
    // Generate JWT token
    const tokenPayload = {
      userId: mockUser._id,
      email: mockUser.email
    };
    
    const token = jwt.sign(
      tokenPayload,
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: "7d" }
    );
    
    // Redirect to frontend
    const redirectUrl = mockUser.profileCompleted 
      ? `${PRODUCTION_CONFIG.frontendUrl}/?token=${token}`
      : `${PRODUCTION_CONFIG.frontendUrl}/complete-profile?token=${token}`;
    
    console.log('✅ Redirecting to:', redirectUrl);
    res.redirect(redirectUrl);
    
  } catch (error) {
    console.error('❌ Google callback error:', error);
    res.redirect(`${PRODUCTION_CONFIG.frontendUrl}/login?error=server_error`);
  }
});

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

    seller.sellerVerificationStatus = status;
    seller.sellerVerified = status === 'approved';
    
    if (username && status === 'approved') {
      const cleanUsername = username.replace(/^@+/, '').replace(/@justbecho/gi, '');
      seller.username = cleanUsername;
    }

    await seller.save();

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