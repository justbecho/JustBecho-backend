import express from "express";
import adminMiddleware from "../middleware/adminMiddleware.js";
import authMiddleware from "../middleware/authMiddleware.js";
import Product from "../models/Product.js";
import User from "../models/User.js";
import { v2 as cloudinary } from 'cloudinary';
import multer from "multer";

const router = express.Router();

// ✅ MULTER CONFIGURATION FOR FILE UPLOAD (Same as user routes)
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 5 // Max 5 files
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/webp',
      'image/heif',
      'image/heic'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images are allowed.'), false);
    }
  }
});

const uploadMiddleware = upload.array('images', 5);

// ✅ ALL ROUTES REQUIRE ADMIN ACCESS
router.use(authMiddleware, adminMiddleware);

// 👑 ADMIN ADD PRODUCT ROUTE (NEW) - Same form as Sell Now
router.post("/products/add", uploadMiddleware, async (req, res) => {
  console.log('=== ADMIN ADD PRODUCT START ===');
  
  try {
    const body = req.body || {};
    const files = req.files || [];
    const admin = req.user;

    console.log('📝 Admin product data:', {
      productName: body.productName,
      brand: body.brand,
      category: body.category,
      sellerId: body.sellerId,
      admin: admin.email
    });

    // ✅ Validate required fields
    const requiredFields = [
      'productName', 'brand', 'category', 'productType', 
      'condition', 'description', 'askingPrice', 'status'
    ];
    
    const missingFields = requiredFields.filter(field => !body[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}`
      });
    }

    // ✅ Determine seller (admin can choose seller or list as admin)
    let sellerId = admin.userId; // Default to admin
    let seller = admin;
    
    if (body.sellerId && body.sellerId !== 'admin') {
      // Find the specified seller
      const specifiedSeller = await User.findById(body.sellerId);
      if (specifiedSeller) {
        sellerId = specifiedSeller._id;
        seller = specifiedSeller;
        console.log(`👤 Using specified seller: ${seller.name} (${seller.email})`);
      } else {
        return res.status(404).json({
          success: false,
          message: 'Specified seller not found'
        });
      }
    } else {
      console.log(`👤 Listing as admin: ${admin.name}`);
    }

    // ✅ STRICT CATEGORY MAPPING (Same as user route)
    const strictCategoryMapping = (category) => {
      const map = {
        // Men's - All variations
        "MEN'S FASHION": "MEN'S FASHION",
        "Men's Fashion": "MEN'S FASHION",
        "Mens Fashion": "MEN'S FASHION", 
        "Mens": "MEN'S FASHION",
        "Men": "MEN'S FASHION",
        "men": "MEN'S FASHION",
        "mens": "MEN'S FASHION",
        "men-fashion": "MEN'S FASHION",
        "men's": "MEN'S FASHION",
        "men's-fashion": "MEN'S FASHION",
        
        // Women's - All variations
        "WOMEN'S FASHION": "WOMEN'S FASHION",
        "Women's Fashion": "WOMEN'S FASHION",
        "Womens Fashion": "WOMEN'S FASHION",
        "Womens": "WOMEN'S FASHION",
        "Women": "WOMEN'S FASHION",
        "women": "WOMEN'S FASHION",
        "womens": "WOMEN'S FASHION",
        "women-fashion": "WOMEN'S FASHION",
        "women's": "WOMEN'S FASHION",
        "women's-fashion": "WOMEN'S FASHION",
        
        // Others
        "FOOTWEAR": "FOOTWEAR",
        "Footwear": "FOOTWEAR",
        "footwear": "FOOTWEAR",
        "Shoes": "FOOTWEAR",
        "shoes": "FOOTWEAR",
        
        "ACCESSORIES": "ACCESSORIES",
        "Accessories": "ACCESSORIES",
        "accessories": "ACCESSORIES",
        
        "WATCHES": "WATCHES",
        "Watches": "WATCHES",
        "watches": "WATCHES",
        
        "PERFUMES": "PERFUMES",
        "Perfumes": "PERFUMES",
        "perfumes": "PERFUMES",
        
        "TOYS & COLLECTIBLES": "TOYS & COLLECTIBLES",
        "Toys & Collectibles": "TOYS & COLLECTIBLES",
        "Toys": "TOYS & COLLECTIBLES",
        "toys": "TOYS & COLLECTIBLES",
        
        "KIDS": "KIDS",
        "Kids": "KIDS",
        "kids": "KIDS",
        
        "INFLUENCER ONLY": "INFLUENCER ONLY",
        "Influencer Only": "INFLUENCER ONLY",
        "influencer": "INFLUENCER ONLY"
      };
      
      // First check exact match
      if (map[category]) {
        return map[category];
      }
      
      // Check case-insensitive
      const upperCategory = category.toUpperCase();
      for (const key in map) {
        if (key.toUpperCase() === upperCategory) {
          return map[key];
        }
      }
      
      return category.toUpperCase();
    };

    const standardizedCategory = strictCategoryMapping(body.category);
    console.log(`📊 Admin category mapping: "${body.category}" → "${standardizedCategory}"`);

    // ✅ Calculate price with 10% fee
    const price = parseFloat(body.askingPrice);
    if (isNaN(price) || price <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid asking price'
      });
    }

    const platformFeePercentage = 10; // ✅ Fixed 10% for all products
    const feeAmount = (price * platformFeePercentage) / 100;
    const finalPrice = Math.ceil(price + feeAmount);
    
    console.log(`💰 Price calculation: ${price} + ${feeAmount} (${platformFeePercentage}%) = ${finalPrice}`);

    // ✅ Upload images (same as user route)
    const imageUrls = [];
    
    if (files && files.length > 0) {
      console.log(`🖼️ Processing ${files.length} images`);
      
      const cloudinaryConfig = {
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
      };

      const isCloudinaryConfigured = cloudinaryConfig.cloud_name && 
                                     cloudinaryConfig.api_key && 
                                     cloudinaryConfig.api_secret;

      for (const [index, file] of files.entries()) {
        try {
          if (!file.buffer) continue;

          let imageUrl = '';
          
          if (isCloudinaryConfigured) {
            const b64 = Buffer.from(file.buffer).toString('base64');
            const dataURI = `data:${file.mimetype};base64,${b64}`;
            
            const result = await cloudinary.uploader.upload(dataURI, {
              folder: 'justbecho/products',
              resource_type: 'image'
            });
            
            imageUrl = result.secure_url;
            console.log(`✅ Image ${index + 1} uploaded to Cloudinary`);
          } else {
            // Fallback placeholder
            const placeholders = [
              'https://images.unsplash.com/photo-1546069901-ba9599a7e63c',
              'https://images.unsplash.com/photo-1565958011703-44f9829ba187'
            ];
            imageUrl = placeholders[Math.floor(Math.random() * placeholders.length)];
            console.log(`🔄 Using placeholder for image ${index + 1}`);
          }
          
          imageUrls.push({
            url: imageUrl,
            publicId: null,
            isPrimary: imageUrls.length === 0
          });
          
        } catch (uploadError) {
          console.error(`❌ Image ${index + 1} upload failed:`, uploadError.message);
          
          // Add placeholder on error
          const placeholders = [
            'https://images.unsplash.com/photo-1546069901-ba9599a7e63c',
            'https://images.unsplash.com/photo-1565958011703-44f9829ba187'
          ];
          const fallbackUrl = placeholders[Math.floor(Math.random() * placeholders.length)];
          
          imageUrls.push({
            url: fallbackUrl,
            publicId: null,
            isPrimary: imageUrls.length === 0
          });
          
          console.log(`🔄 Using fallback for image ${index + 1}`);
        }
      }
    } else {
      console.log('ℹ️ No images provided, using placeholder');
      
      // Add default placeholder image
      const placeholders = [
        'https://images.unsplash.com/photo-1546069901-ba9599a7e63c',
        'https://images.unsplash.com/photo-1565958011703-44f9829ba187'
      ];
      const fallbackUrl = placeholders[Math.floor(Math.random() * placeholders.length)];
      
      imageUrls.push({
        url: fallbackUrl,
        publicId: null,
        isPrimary: true
      });
    }

    // ✅ Create product data
    const productData = {
      productName: body.productName,
      brand: body.brand,
      category: standardizedCategory,
      productType: body.productType,
      condition: body.condition,
      description: body.description,
      askingPrice: price,
      platformFee: platformFeePercentage,
      finalPrice: finalPrice,
      images: imageUrls,
      seller: sellerId,
      sellerName: seller.name || seller.email.split('@')[0],
      sellerUsername: seller.username || '',
      shippingStatus: 'pending',
      status: body.status,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      listedByAdmin: true,
      adminId: admin.userId,
      adminName: admin.name || admin.email
    };

    if (body.purchaseYear && !isNaN(parseInt(body.purchaseYear))) {
      productData.purchaseYear = parseInt(body.purchaseYear);
    }

    console.log('📦 Creating product with data:', {
      productName: productData.productName,
      brand: productData.brand,
      category: productData.category,
      seller: productData.sellerName,
      status: productData.status,
      images: productData.images.length
    });

    // ✅ Create and save product
    const product = new Product(productData);
    const savedProduct = await product.save();
    
    console.log('✅ Admin product created successfully:', savedProduct._id);

    res.status(201).json({
      success: true,
      message: 'Product added successfully by admin',
      product: {
        id: savedProduct._id,
        productName: savedProduct.productName,
        brand: savedProduct.brand,
        category: savedProduct.category,
        status: savedProduct.status,
        finalPrice: savedProduct.finalPrice,
        sellerName: savedProduct.sellerName,
        images: savedProduct.images.map(img => img.url),
        shippingStatus: savedProduct.shippingStatus
      }
    });

  } catch (error) {
    console.error('❌ ADMIN ADD PRODUCT ERROR:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed: ' + messages.join(', ')
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while adding product: ' + error.message
    });
  }
});

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