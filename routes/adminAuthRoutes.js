import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const router = express.Router();

// ✅ ADMIN LOGIN - FIXED WITH YOUR ENV
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log('👑 Admin login attempt:', email);

    // ✅ IMPORTANT: Use environment JWT_SECRET
    const JWT_SECRET = process.env.JWT_SECRET || "supersecretjustbecho";
    console.log('🔑 Using JWT_SECRET:', JWT_SECRET ? 'Set' : 'Not set');

    // ✅ Allow default admin credentials
    if (email === "admin@justbecho.com" && password === "admin123") {
      console.log('✅ Using default admin credentials');
      
      // Check if admin user exists in database
      let user = await User.findOne({ email: "admin@justbecho.com" });
      
      if (!user) {
        // Create admin user if doesn't exist
        const hashedPassword = await bcrypt.hash("admin123", 10);
        
        user = new User({
          email: "admin@justbecho.com",
          name: "Admin User",
          password: hashedPassword,
          role: "admin",
          profileCompleted: true,
          sellerVerified: true
        });
        
        await user.save();
        console.log('✅ Admin user created in database');
      }

      // Create JWT token
      const token = jwt.sign(
        {
          userId: user._id,
          email: user.email,
          role: user.role,
          name: user.name
        },
        JWT_SECRET,
        { expiresIn: "24h" }
      );

      console.log('✅ Admin login successful, token generated');

      res.json({
        success: true,
        message: "Admin login successful",
        token,
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role
        }
      });
      return;
    }

    // ✅ Check if user exists for other emails
    const user = await User.findOne({ email });
    if (!user) {
      console.log('❌ User not found:', email);
      return res.status(400).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    // ✅ Check if user is admin
    if (user.role !== 'admin') {
      console.log('❌ User is not admin. Role:', user.role);
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin only."
      });
    }

    // ✅ Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log('❌ Password mismatch');
      return res.status(400).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    // ✅ Create JWT token
    const token = jwt.sign(
      {
        userId: user._id,
        email: user.email,
        role: user.role,
        name: user.name
      },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    console.log('✅ Admin login successful:', user.email);

    res.json({
      success: true,
      message: "Admin login successful",
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });

  } catch (error) {
    console.error('❌ Admin login error:', error);
    res.status(500).json({
      success: false,
      message: "Server error: " + error.message
    });
  }
});

// ✅ GET ADMIN PROFILE
router.get("/profile", async (req, res) => {
  try {
    console.log('🔍 Admin profile request received');
    
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      console.log('❌ No authorization header');
      return res.status(401).json({
        success: false,
        message: "No token provided"
      });
    }

    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.split(' ')[1] 
      : authHeader;
    
    console.log('Token received:', token ? token.substring(0, 20) + '...' : 'No token');

    if (!token) {
      console.log('❌ Token not found in header');
      return res.status(401).json({
        success: false,
        message: "No token provided"
      });
    }

    // ✅ Use environment JWT_SECRET
    const JWT_SECRET = process.env.JWT_SECRET || "supersecretjustbecho";

    // ✅ Verify token
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      console.log('✅ Token decoded:', decoded);
      
      const user = await User.findById(decoded.userId).select("-password");
      
      if (!user) {
        console.log('❌ User not found for ID:', decoded.userId);
        return res.status(404).json({
          success: false,
          message: "User not found"
        });
      }

      if (user.role !== 'admin') {
        console.log('❌ User is not admin:', user.role);
        return res.status(403).json({
          success: false,
          message: "Access denied. Admin only."
        });
      }

      console.log('✅ Admin profile fetched:', user.email);

      res.json({
        success: true,
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
          profileCompleted: user.profileCompleted,
          sellerVerified: user.sellerVerified
        }
      });

    } catch (jwtError) {
      console.error('❌ JWT verification error:', jwtError.message);
      return res.status(401).json({
        success: false,
        message: "Invalid token: " + jwtError.message
      });
    }

  } catch (error) {
    console.error('❌ Admin profile error:', error);
    res.status(500).json({
      success: false,
      message: "Server error: " + error.message
    });
  }
});

// ✅ UPDATE ADMIN PASSWORD
router.put("/change-password", async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "No token provided"
      });
    }

    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.split(' ')[1] 
      : authHeader;

    // ✅ Use environment JWT_SECRET
    const JWT_SECRET = process.env.JWT_SECRET || "supersecretjustbecho";

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId);
    
    if (!user || user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect"
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    res.json({
      success: true,
      message: "Password changed successfully"
    });

  } catch (error) {
    console.error('❌ Change password error:', error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

// ✅ ADMIN LOGOUT
router.post("/logout", (req, res) => {
  res.json({
    success: true,
    message: "Admin logged out successfully"
  });
});

export default router;