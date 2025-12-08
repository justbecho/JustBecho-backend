import User from "../models/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { sendSellerVerificationToAdmin } from "../config/telegramBot.js";

export const signup = async (req, res) => {
  try {
    console.log("📝 Signup request:", req.body);
    
    const { email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ 
        success: false,
        message: "Email already in use" 
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      email,
      password: hashedPassword,
      profileCompleted: false,
      role: 'user'
    });

    await user.save();

    const tokenPayload = {
      userId: user._id.toString(),
      email: user.email
    };

    const token = jwt.sign(
      tokenPayload,
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );

    console.log("✅ Signup successful for:", email);
    
    res.status(201).json({ 
      success: true,
      message: "Signup successful", 
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name || user.email.split('@')[0],
        profileCompleted: user.profileCompleted,
        role: user.role,
        sellerVerified: user.sellerVerified
      },
      redirectTo: '/complete-profile'
    });

  } catch (err) {
    console.error("❌ Signup error:", err);
    res.status(500).json({ 
      success: false,
      message: "Server error", 
      error: err.message 
    });
  }
};

export const login = async (req, res) => {
  try {
    console.log("🔐 Login request:", req.body);
    
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      console.log("❌ User not found:", email);
      return res.status(400).json({ 
        success: false,
        message: "Invalid email or password" 
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log("❌ Password mismatch for:", email);
      return res.status(400).json({ 
        success: false,
        message: "Invalid email or password" 
      });
    }

    const tokenPayload = {
      userId: user._id.toString(),
      email: user.email
    };

    const token = jwt.sign(
      tokenPayload,
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );

    console.log("✅ Login successful for:", email);
    
    let redirectTo = '/dashboard';
    
    if (!user.profileCompleted) {
      redirectTo = '/complete-profile';
    }

    res.json({ 
      success: true,
      message: "Login successful", 
      token,
      redirectTo,
      user: {
        id: user._id,
        email: user.email,
        name: user.name || user.email.split('@')[0],
        username: user.username, // Send as-is "name@justbecho"
        profileCompleted: user.profileCompleted,
        role: user.role,
        instaId: user.instaId,
        sellerVerified: user.sellerVerified,
        sellerVerificationStatus: user.sellerVerificationStatus,
        verificationId: user.verificationId,
        phone: user.phone,
        address: user.address,
        bankDetails: user.bankDetails
      }
    });

  } catch (err) {
    console.error("❌ Login error:", err);
    res.status(500).json({ 
      success: false,
      message: "Server error", 
      error: err.message 
    });
  }
};

// ✅ NEW: Generate username "name@justbecho"
const generateSellerUsername = async (name, userId) => {
  try {
    // Create base username from name
    const baseUsername = name.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
    
    // Remove any @ symbols from the start
    let cleanBase = baseUsername.replace(/^@+/, '');
    
    // Take first 15 characters max
    cleanBase = cleanBase.substring(0, 15);
    
    // ✅ IMPORTANT: Generate "name@justbecho" format
    let username = `${cleanBase}@justbecho`;
    
    // Check if username exists
    const existingUser = await User.findOne({ 
      username: username,
      _id: { $ne: userId }
    });

    // If exists, add numbers until unique
    if (existingUser) {
      let counter = 1;
      while (existingUser) {
        username = `${cleanBase}${counter}@justbecho`;
        const checkUser = await User.findOne({ 
          username: username,
          _id: { $ne: userId }
        });
        if (!checkUser) break;
        counter++;
        // Safety break
        if (counter > 1000) {
          username = `${cleanBase}${Date.now().toString().slice(-6)}@justbecho`;
          break;
        }
      }
    }

    return username; // Returns "name@justbecho" format
    
  } catch (error) {
    console.error('Error generating username:', error);
    // Fallback
    const cleanBase = name.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '').substring(0, 10);
    return `${cleanBase}${Date.now().toString().slice(-4)}@justbecho`;
  }
};

// ✅ NEW: Ensure username is in "name@justbecho" format
const ensureJustbechoFormat = (username) => {
  if (!username) return null;
  
  // Remove any leading @
  let clean = username.replace(/^@+/, '');
  
  // If already ends with @justbecho, return as-is
  if (clean.endsWith('@justbecho')) {
    return clean;
  }
  
  // If contains @justbecho elsewhere, fix it
  if (clean.includes('@justbecho')) {
    const namePart = clean.replace('@justbecho', '');
    return `${namePart}@justbecho`;
  }
  
  // Add @justbecho suffix
  return `${clean}@justbecho`;
};

export const completeProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { 
      role, 
      name, 
      phone, 
      address, 
      instaId, 
      bankDetails 
    } = req.body;

    console.log('📝 Completing profile for user:', userId);
    console.log('📋 Received data:', { role, name, phone, address, instaId, bankDetails });

    if (!role || !name || !phone || !address) {
      return res.status(400).json({
        success: false,
        message: 'Role, name, phone and address are required'
      });
    }

    if (!['buyer', 'seller', 'influencer'].includes(role)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid role' 
      });
    }

    if (!address.street || !address.city || !address.state || !address.pincode) {
      return res.status(400).json({
        success: false,
        message: 'Complete address (street, city, state, pincode) is required'
      });
    }

    if (!/^\d{10}$/.test(phone)) {
      return res.status(400).json({
        success: false,
        message: 'Valid 10-digit phone number is required'
      });
    }

    if (!/^\d{6}$/.test(address.pincode)) {
      return res.status(400).json({
        success: false,
        message: 'Valid 6-digit pincode is required'
      });
    }

    if (role === 'influencer') {
      if (!instaId || !instaId.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Instagram ID is required for influencers'
        });
      }
    }

    if (role === 'seller') {
      if (!bankDetails || !bankDetails.accountNumber || !bankDetails.ifscCode || !bankDetails.accountName) {
        return res.status(400).json({
          success: false,
          message: 'Bank details (account number, IFSC code, account name) are required for sellers'
        });
      }

      if (!/^\d{9,18}$/.test(bankDetails.accountNumber)) {
        return res.status(400).json({
          success: false,
          message: 'Valid account number required (9-18 digits)'
        });
      }

      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(bankDetails.ifscCode)) {
        return res.status(400).json({
          success: false,
          message: 'Valid IFSC code required (e.g., SBIN0001234)'
        });
      }
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.role = role;
    user.name = name;
    user.phone = phone;
    user.address = address;
    user.profileCompleted = true;

    if (role === 'influencer') {
      user.instaId = instaId;
    }

    if (role === 'seller') {
      console.log('🏪 Seller profile created');
      
      user.bankDetails = {
        accountNumber: bankDetails.accountNumber,
        ifscCode: bankDetails.ifscCode,
        accountName: bankDetails.accountName
      };
      
      // ✅ FIXED: Generate username "name@justbecho"
      const username = await generateSellerUsername(name, userId);
      user.username = username; // Store as "name@justbecho"
      
      console.log(`👤 Username generated for seller: ${user.username}`);
      
      user.sellerVerified = false;
      user.sellerVerificationStatus = 'pending';
      
      const telegramResult = await sendSellerVerificationToAdmin(user);
      
      if (telegramResult && telegramResult.verificationId) {
        user.verificationId = telegramResult.verificationId;
        console.log('📱 Telegram verification sent, ID:', telegramResult.verificationId);
      }
      
      console.log('🏪 Seller waiting for Telegram approval');
    }

    await user.save();
    console.log('✅ Profile completed successfully for user:', user.email);

    const responseData = {
      id: user._id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      address: user.address,
      role: user.role,
      profileCompleted: user.profileCompleted,
      instaId: user.instaId,
      sellerVerified: user.sellerVerified,
      sellerVerificationStatus: user.sellerVerificationStatus,
      verificationId: user.verificationId,
      username: user.username // Send as "name@justbecho"
    };

    if (role === 'seller') {
      responseData.bankDetails = user.bankDetails;
    }

    res.json({
      success: true,
      message: role === 'seller' 
        ? 'Profile completed! Verification sent to admin. Check Telegram for approval.' 
        : 'Profile completed successfully.',
      user: responseData,
      redirectTo: '/dashboard'
    });

  } catch (error) {
    console.error('❌ Complete profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
};

// ✅ NEW: Convert buyer to seller API
export const convertToSeller = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    console.log(`🔄 Converting user ${userId} to seller`);
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Check if already a seller
    if (user.role === 'seller') {
      return res.status(400).json({
        success: false,
        message: 'User is already a seller'
      });
    }
    
    // Check if profile is completed
    if (!user.profileCompleted) {
      return res.status(400).json({
        success: false,
        message: 'Please complete your profile first'
      });
    }
    
    // Check if required fields are present
    if (!user.name || !user.phone || !user.address) {
      return res.status(400).json({
        success: false,
        message: 'Please complete your name, phone and address in profile'
      });
    }
    
    // ✅ FIXED: Generate username "name@justbecho"
    const username = await generateSellerUsername(user.name, userId);
    
    // Update user to seller
    user.role = 'seller';
    user.username = username; // Store as "name@justbecho"
    user.sellerVerified = false;
    user.sellerVerificationStatus = 'pending';
    user.bankDetails = user.bankDetails || {}; // Initialize if not present
    
    // Generate verification ID for Telegram
    const verificationId = `SELLER-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    user.verificationId = verificationId;
    
    await user.save();
    
    // Send Telegram notification
    const telegramResult = await sendSellerVerificationToAdmin(user);
    
    if (telegramResult && telegramResult.success) {
      console.log('📱 Telegram verification sent for converted seller');
    }
    
    // Generate new token with updated role
    const tokenPayload = {
      userId: user._id.toString(),
      email: user.email,
      role: user.role
    };
    
    const token = jwt.sign(
      tokenPayload,
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );
    
    console.log(`✅ User ${user.email} converted to seller`);
    console.log(`👤 Username: ${user.username}`);
    
    res.json({
      success: true,
      message: 'Successfully converted to seller. Please complete seller profile details including bank information.',
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        username: user.username, // Send as "name@justbecho"
        role: user.role,
        profileCompleted: user.profileCompleted,
        sellerVerified: user.sellerVerified,
        sellerVerificationStatus: user.sellerVerificationStatus,
        verificationId: user.verificationId,
        phone: user.phone,
        address: user.address
      },
      redirectTo: '/complete-profile?convertingToSeller=true'
    });
    
  } catch (error) {
    console.error('❌ Convert to seller error:', error);
    res.status(500).json({
      success: false,
      message: 'Error converting to seller: ' + error.message
    });
  }
};

export const getMe = async (req, res) => {
  try {
    console.log('🎯 GetMe request for user:', req.user);
    
    const userId = req.user.userId;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID not found in request'
      });
    }

    const user = await User.findById(userId).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // ✅ FIXED: Ensure username is in "name@justbecho" format
    const formattedUsername = ensureJustbechoFormat(user.username);

    res.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        name: user.name || user.email.split('@')[0],
        username: formattedUsername, // Send as "name@justbecho"
        profileCompleted: user.profileCompleted,
        role: user.role,
        instaId: user.instaId,
        sellerVerified: user.sellerVerified,
        sellerVerificationStatus: user.sellerVerificationStatus,
        verificationId: user.verificationId,
        phone: user.phone,
        address: user.address,
        bankDetails: user.bankDetails
      }
    });
  } catch (error) {
    console.error('❌ GetMe error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
};

export const checkProfileStatus = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const user = await User.findById(userId).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // ✅ FIXED: Ensure username is in "name@justbecho" format
    const formattedUsername = ensureJustbechoFormat(user.username);

    res.json({
      success: true,
      profileCompleted: user.profileCompleted,
      role: user.role,
      instaId: user.instaId,
      sellerVerified: user.sellerVerified,
      sellerVerificationStatus: user.sellerVerificationStatus,
      verificationId: user.verificationId,
      username: formattedUsername, // Send as "name@justbecho"
      phone: user.phone,
      address: user.address,
      bankDetails: user.bankDetails
    });

  } catch (error) {
    console.error('❌ Check profile status error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error while checking profile status' 
    });
  }
};

// ✅ NEW: Update user profile
export const updateProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { name, phone, address } = req.body;

    console.log('📝 Updating profile for user:', userId);

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update fields if provided
    if (name) user.name = name;
    if (phone) {
      if (!/^\d{10}$/.test(phone)) {
        return res.status(400).json({
          success: false,
          message: 'Valid 10-digit phone number is required'
        });
      }
      user.phone = phone;
    }
    if (address) {
      if (!address.street || !address.city || !address.state || !address.pincode) {
        return res.status(400).json({
          success: false,
          message: 'Complete address (street, city, state, pincode) is required'
        });
      }
      if (!/^\d{6}$/.test(address.pincode)) {
        return res.status(400).json({
          success: false,
          message: 'Valid 6-digit pincode is required'
        });
      }
      user.address = address;
    }

    await user.save();

    // ✅ FIXED: Ensure username is in "name@justbecho" format
    const formattedUsername = ensureJustbechoFormat(user.username);

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        username: formattedUsername, // Send as "name@justbecho"
        phone: user.phone,
        address: user.address,
        role: user.role,
        profileCompleted: user.profileCompleted,
        sellerVerified: user.sellerVerified,
        sellerVerificationStatus: user.sellerVerificationStatus
      }
    });

  } catch (error) {
    console.error('❌ Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
};

// ✅ NEW: Update seller bank details
export const updateBankDetails = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { bankDetails } = req.body;

    console.log('🏦 Updating bank details for user:', userId);

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.role !== 'seller') {
      return res.status(400).json({
        success: false,
        message: 'Only sellers can update bank details'
      });
    }

    if (!bankDetails || !bankDetails.accountNumber || !bankDetails.ifscCode || !bankDetails.accountName) {
      return res.status(400).json({
        success: false,
        message: 'Bank details (account number, IFSC code, account name) are required'
      });
    }

    if (!/^\d{9,18}$/.test(bankDetails.accountNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Valid account number required (9-18 digits)'
      });
    }

    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(bankDetails.ifscCode)) {
      return res.status(400).json({
        success: false,
        message: 'Valid IFSC code required (e.g., SBIN0001234)'
      });
    }

    user.bankDetails = {
      accountNumber: bankDetails.accountNumber,
      ifscCode: bankDetails.ifscCode,
      accountName: bankDetails.accountName
    };

    await user.save();

    res.json({
      success: true,
      message: 'Bank details updated successfully',
      bankDetails: user.bankDetails
    });

  } catch (error) {
    console.error('❌ Update bank details error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
};

// ✅ NEW: Get seller verification status
export const getSellerStatus = async (req, res) => {
  try {
    const userId = req.user.userId;

    const user = await User.findById(userId).select('-password');
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

    // ✅ FIXED: Ensure username is in "name@justbecho" format
    const formattedUsername = ensureJustbechoFormat(user.username);

    res.json({
      success: true,
      sellerVerified: user.sellerVerified,
      sellerVerificationStatus: user.sellerVerificationStatus,
      verificationId: user.verificationId,
      username: formattedUsername, // Send as "name@justbecho"
      role: user.role,
      name: user.name,
      email: user.email
    });

  } catch (error) {
    console.error('❌ Get seller status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while checking seller status'
    });
  }
};