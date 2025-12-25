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

// ✅ Production Configuration
const PRODUCTION_CONFIG = {
  clientId: '711574038874-r069ib4ureqbir5sukg69at13hspa9a8.apps.googleusercontent.com',
  backendUrl: 'https://just-becho-backend.vercel.app',
  frontendUrl: 'https://justbecho.com'
};

console.log('🚀 Google OAuth Configuration:');
console.log('   Client ID:', PRODUCTION_CONFIG.clientId);
console.log('   Backend URL:', PRODUCTION_CONFIG.backendUrl);
console.log('   Frontend URL:', PRODUCTION_CONFIG.frontendUrl);

// ✅ AUTH ROUTES
router.post("/signup", signup);
router.post("/login", login);
router.get("/me", authMiddleware, getMe);
router.post("/complete-profile", authMiddleware, completeProfile);
router.get("/profile-status", authMiddleware, checkProfileStatus);
router.put("/convert-to-seller", authMiddleware, convertToSeller);
router.put("/profile", authMiddleware, updateProfile);
router.put("/bank-details", authMiddleware, updateBankDetails);
router.get("/seller-status", authMiddleware, getSellerStatus);

// ✅ PROFILE CHECK
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

// ✅ DASHBOARD
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

// ✅ UPDATE PROFILE
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

// ✅ GOOGLE OAUTH - INITIATE
router.get("/google", (req, res) => {
  console.log('🚀 Google OAuth initiated');
  
  // Get frontend URL from query parameter or use default
  const frontendUrl = req.query.frontend || PRODUCTION_CONFIG.frontendUrl;
  
  // ✅ Use BACKEND callback URL (must match Google Console)
  const callbackUrl = `${PRODUCTION_CONFIG.backendUrl}/api/auth/google/callback`;
  
  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${PRODUCTION_CONFIG.clientId}&` +
    `redirect_uri=${encodeURIComponent(callbackUrl)}&` +
    `response_type=code&` +
    `scope=profile%20email&` +
    `access_type=offline&` +
    `prompt=consent&` +
    `state=${encodeURIComponent(frontendUrl)}`;
  
  console.log('🌐 Google Auth Details:');
  console.log('   Redirect URI:', callbackUrl);
  console.log('   Frontend URL:', frontendUrl);
  
  res.redirect(googleAuthUrl);
});

// ✅ GOOGLE OAUTH CALLBACK - UPDATED WITH isNewUser FLAG
router.get("/google/callback", async (req, res) => {
  try {
    console.log('🔄 ===== GOOGLE CALLBACK STARTED =====');
    console.log('Query params:', req.query);
    
    const { code, error, error_description, state } = req.query;
    
    if (error) {
      console.error('❌ Google OAuth error:', error);
      console.error('Error description:', error_description);
      
      const frontendUrl = state ? decodeURIComponent(state) : PRODUCTION_CONFIG.frontendUrl;
      return res.redirect(`${frontendUrl}/login?error=google_${error}`);
    }
    
    if (!code) {
      console.error('❌ No authorization code received');
      
      const frontendUrl = state ? decodeURIComponent(state) : PRODUCTION_CONFIG.frontendUrl;
      return res.redirect(`${frontendUrl}/login?error=no_auth_code`);
    }
    
    console.log('✅ Authorization code received');
    
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    
    if (!clientSecret) {
      console.error('❌ GOOGLE_CLIENT_SECRET not found');
      
      const frontendUrl = state ? decodeURIComponent(state) : PRODUCTION_CONFIG.frontendUrl;
      return res.redirect(`${frontendUrl}/login?error=missing_config`);
    }
    
    // ✅ Determine frontend URL from state
    const frontendUrl = state ? decodeURIComponent(state) : PRODUCTION_CONFIG.frontendUrl;
    const callbackUrl = `${PRODUCTION_CONFIG.backendUrl}/api/auth/google/callback`;
    
    console.log('🌐 Callback Details:');
    console.log('   Frontend URL:', frontendUrl);
    console.log('   Callback URL:', callbackUrl);
    
    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code: code,
        client_id: PRODUCTION_CONFIG.clientId,
        client_secret: clientSecret,
        redirect_uri: callbackUrl,
        grant_type: 'authorization_code'
      })
    });
    
    const tokenData = await tokenResponse.json();
    
    if (tokenData.error) {
      console.error('❌ Token exchange failed:', tokenData.error);
      return res.redirect(`${frontendUrl}/login?error=token_exchange`);
    }
    
    const { access_token } = tokenData;
    
    // Get user info from Google
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: {
        'Authorization': `Bearer ${access_token}`
      }
    });
    
    const userInfo = await userInfoResponse.json();
    console.log('✅ Google user info:', userInfo);
    
    // Find or create user in database
    let user = await User.findOne({ 
      $or: [
        { email: userInfo.email },
        { googleId: userInfo.sub }
      ]
    });
    
    let isNewUser = false;
    
    if (!user) {
      // Create new user
      user = new User({
        email: userInfo.email,
        name: userInfo.name || userInfo.email.split('@')[0],
        googleId: userInfo.sub,
        profileCompleted: false,
        role: 'user'
      });
      await user.save();
      isNewUser = true;
      console.log('✅ New user created in database');
    } else {
      // Update existing user
      if (!user.googleId) {
        user.googleId = userInfo.sub;
        await user.save();
      }
      console.log('✅ Existing user found');
    }
    
    // ✅ Generate JWT token with isNewUser flag
    const tokenPayload = {
      userId: user._id.toString(),
      email: user.email,
      isNewUser: isNewUser, // ✅ CRITICAL: Add this flag
      name: user.name,
      role: user.role,
      profileCompleted: user.profileCompleted
    };
    
    const jwtToken = jwt.sign(
      tokenPayload,
      process.env.JWT_SECRET || 'fallback_jwt_secret_for_development',
      { expiresIn: "7d" }
    );
    
    console.log('✅ JWT token generated');
    console.log('👤 User details:', {
      isNewUser: isNewUser,
      profileCompleted: user.profileCompleted,
      role: user.role
    });
    
    // ✅ CRITICAL: Different redirect logic based on user status
    let redirectUrl = `${frontendUrl}`;
    
    if (isNewUser) {
      // New Google user - go to homepage (role selection will be triggered)
      redirectUrl = `${frontendUrl}?token=${jwtToken}&newUser=true&source=google`;
      console.log('👶 New Google user, will show role selection');
    } else {
      // Existing user - check profile completion
      if (!user.profileCompleted) {
        redirectUrl = `${frontendUrl}/complete-profile?token=${jwtToken}&source=google`;
        console.log('🔄 Existing user, profile not completed');
      } else {
        redirectUrl = `${frontendUrl}/dashboard?token=${jwtToken}&source=google`;
        console.log('🚀 Existing user with completed profile, redirecting to dashboard');
      }
    }
    
    // Add user info to URL
    if (user.name) {
      redirectUrl += `&name=${encodeURIComponent(user.name)}`;
    }
    if (user.email) {
      redirectUrl += `&email=${encodeURIComponent(user.email)}`;
    }
    
    console.log('Final redirect URL:', redirectUrl);
    console.log('===== GOOGLE CALLBACK COMPLETED =====\n');
    
    res.redirect(redirectUrl);
    
  } catch (error) {
    console.error('❌ Google callback error:', error);
    console.error('Error stack:', error.stack);
    
    const frontendUrl = PRODUCTION_CONFIG.frontendUrl;
    res.redirect(`${frontendUrl}/login?error=auth_failed`);
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