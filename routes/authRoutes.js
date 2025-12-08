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

// ✅ GOOGLE OAUTH DEBUG ENDPOINT
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
    testInstructions: 'Copy the googleAuthUrl and paste in browser'
  });
});

// ✅ GOOGLE OAUTH INITIATE
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
  
  console.log('Redirecting to Google:', googleAuthUrl);
  res.redirect(googleAuthUrl);
});

// ✅ GOOGLE CALLBACK - WORKING VERSION
router.get("/google/callback", async (req, res) => {
  try {
    console.log('🔄 ===== GOOGLE CALLBACK STARTED =====');
    console.log('Full URL:', req.protocol + '://' + req.get('host') + req.originalUrl);
    console.log('Query params:', req.query);
    
    const { code, error, error_description } = req.query;
    
    if (error) {
      console.error('❌ Google OAuth error:', error);
      console.error('Error description:', error_description);
      return res.redirect(`${PRODUCTION_CONFIG.frontendUrl}/login?error=google_${error}`);
    }
    
    if (!code) {
      console.error('❌ No authorization code received');
      return res.redirect(`${PRODUCTION_CONFIG.frontendUrl}/login?error=no_auth_code`);
    }
    
    console.log('✅ Authorization code received');
    
    // Get Google Client Secret from environment
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    
    if (!clientSecret) {
      console.error('❌ GOOGLE_CLIENT_SECRET not found in environment');
      // Continue with mock flow for testing
      return handleMockGoogleAuth(req, res);
    }
    
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
        redirect_uri: PRODUCTION_CONFIG.redirectUri,
        grant_type: 'authorization_code'
      })
    });
    
    const tokenData = await tokenResponse.json();
    console.log('Token exchange response:', tokenData);
    
    if (tokenData.error) {
      console.error('❌ Token exchange failed:', tokenData.error);
      return res.redirect(`${PRODUCTION_CONFIG.frontendUrl}/login?error=token_exchange`);
    }
    
    const { access_token, id_token } = tokenData;
    
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
      console.log('✅ New user created in database');
    } else {
      // Update existing user
      if (!user.googleId) {
        user.googleId = userInfo.sub;
        await user.save();
      }
      console.log('✅ Existing user found');
    }
    
    // Generate JWT token
    const tokenPayload = {
      userId: user._id.toString(),
      email: user.email
    };
    
    const jwtToken = jwt.sign(
      tokenPayload,
      process.env.JWT_SECRET || 'fallback_jwt_secret_for_development',
      { expiresIn: "7d" }
    );
    
    console.log('✅ JWT token generated');
    
    // Redirect to frontend
    let redirectUrl = `${PRODUCTION_CONFIG.frontendUrl}/`;
    
    if (!user.profileCompleted) {
      redirectUrl = `${PRODUCTION_CONFIG.frontendUrl}/complete-profile`;
      console.log('🔄 Redirecting to complete profile');
    } else {
      console.log('🚀 Redirecting to home page');
    }
    
    redirectUrl += `?token=${jwtToken}`;
    
    // Add user info
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
    
    // Fallback to mock auth
    handleMockGoogleAuth(req, res);
  }
});

// ✅ MOCK GOOGLE AUTH FOR TESTING
const handleMockGoogleAuth = (req, res) => {
  console.log('⚠️ Using mock Google auth (for testing)');
  
  // Generate mock token
  const mockToken = jwt.sign(
    { userId: 'mock_' + Date.now(), email: 'test@example.com' },
    process.env.JWT_SECRET || 'mock_secret',
    { expiresIn: "1h" }
  );
  
  const redirectUrl = `${PRODUCTION_CONFIG.frontendUrl}/?token=${mockToken}&mock=true&source=google`;
  
  console.log('Mock redirect URL:', redirectUrl);
  res.redirect(redirectUrl);
};

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

// ✅ GOOGLE OAUTH TEST PAGE
router.get('/test-google', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Google OAuth Test</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 30px; max-width: 800px; margin: 0 auto; }
        .container { background: #f8f9fa; padding: 20px; border-radius: 10px; }
        h1 { color: #4285f4; }
        .step { margin: 20px 0; padding: 15px; border-left: 4px solid #4285f4; background: white; }
        .success { border-color: #34a853; }
        .error { border-color: #ea4335; }
        button { background: #4285f4; color: white; border: none; padding: 12px 24px; cursor: pointer; border-radius: 5px; font-size: 16px; margin: 10px 0; }
        button:hover { background: #3367d6; }
        .info { background: #e8f0fe; padding: 10px; border-radius: 5px; margin: 10px 0; }
        code { background: #f1f3f4; padding: 2px 5px; border-radius: 3px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🔐 Google OAuth Test Page</h1>
        
        <div class="step">
          <h2>Test 1: Direct Google URL</h2>
          <a href="https://accounts.google.com/o/oauth2/v2/auth?client_id=711574038874-r069ib4ureqbir5sukg69at13hspa9a8.apps.googleusercontent.com&redirect_uri=https://just-becho-backend.vercel.app/api/auth/google/callback&response_type=code&scope=profile%20email&access_type=offline&prompt=consent">
            <button>Test Direct Google Login</button>
          </a>
          <p>This opens Google sign-in page directly</p>
        </div>
        
        <div class="step">
          <h2>Test 2: Via Backend Route</h2>
          <a href="/api/auth/google">
            <button>Test via Backend Route (/api/auth/google)</button>
          </a>
          <p>This uses the backend redirect route</p>
        </div>
        
        <div class="step">
          <h2>Debug Information</h2>
          <div class="info">
            <p><strong>Client ID:</strong> 711574038874...a9a8.apps.googleusercontent.com</p>
            <p><strong>Redirect URI:</strong> https://just-becho-backend.vercel.app/api/auth/google/callback</p>
            <p><strong>Frontend URL:</strong> ${PRODUCTION_CONFIG.frontendUrl}</p>
            <p><strong>Client Secret:</strong> ${process.env.GOOGLE_CLIENT_SECRET ? '✅ Set' : '❌ Missing'}</p>
          </div>
        </div>
        
        <div class="step">
          <h2>Test Links</h2>
          <p><a href="/api/auth/google/debug">Debug Info JSON</a></p>
          <p><a href="/api/health">Health Check</a></p>
          <p><a href="/">API Home</a></p>
        </div>
        
        <div class="step success">
          <h2>✅ If Successful</h2>
          <p>After Google login, you should be redirected to:</p>
          <code>${PRODUCTION_CONFIG.frontendUrl}/?token=...&source=google</code>
        </div>
      </div>
    </body>
    </html>
  `);
});

export default router;