// controllers/productController.js - COMPLETE FIXED VERSION FOR VERCEL
import Product from "../models/Product.js";
import User from "../models/User.js";

// ✅ CREATE PRODUCT - FIXED FOR VERCEL (NO LOCAL UPLOADS)
const createProduct = async (req, res) => {
  console.log('=== 🚨 CREATE PRODUCT REQUEST START ===');
  
  try {
    console.log('📥 Request Body:', req.body);
    console.log('📸 Files from Cloudinary middleware:', req.files);
    console.log('👤 User:', req.user);

    // ✅ Validate authentication
    if (!req.user || !req.user.userId) {
      return res.status(401).json({
        success: false,
        message: 'Please login to list a product'
      });
    }

    // ✅ Validate required fields
    const requiredFields = [
      'productName', 'brand', 'category', 'productType', 
      'condition', 'description', 'askingPrice'
    ];
    
    const missingFields = requiredFields.filter(field => !req.body[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}`
      });
    }

    const { 
      productName, 
      brand, 
      category, 
      productType, 
      condition, 
      description, 
      askingPrice,
      purchaseYear 
    } = req.body;

    // ✅ Validate images (from Cloudinary middleware)
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one product image is required'
      });
    }

    console.log('✅ All validations passed');

    // ✅ FIXED: Calculate platform fee and final price
    const price = parseFloat(askingPrice);
    console.log('💰 Price parsing:', { askingPrice, parsed: price });

    if (isNaN(price) || price <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid asking price'
      });
    }

    // ✅ Platform fee calculation
    let platformFeePercentage = 0;
    
    if (price <= 2000) {
      platformFeePercentage = 30;
    } else if (price <= 5000) {
      platformFeePercentage = 28;
    } else if (price <= 10000) {
      platformFeePercentage = 25;
    } else if (price <= 15000) {
      platformFeePercentage = 20;
    } else {
      platformFeePercentage = 15;
    }

    // ✅ Ensure numbers are valid
    const feeAmount = (price * platformFeePercentage) / 100;
    const finalPrice = Math.ceil(price + feeAmount);

    console.log('💰 FINAL Price Calculation:', {
      askingPrice: price,
      platformFee: platformFeePercentage,
      feeAmount: feeAmount,
      finalPrice: finalPrice
    });

    // ✅ FIXED: Process Cloudinary images (req.files already have Cloudinary objects)
    const imageUrls = req.files.map((file, index) => ({
      url: file.path, // Cloudinary URL
      publicId: file.filename, // Cloudinary public_id
      isPrimary: index === 0
    }));

    console.log('🖼️ Cloudinary Images:', imageUrls);

    // ✅ FIXED: Create product data with PROPER numbers
    const productData = {
      productName: productName.toString().trim(),
      brand: brand.toString().trim(),
      category: category.toString().trim(),
      productType: productType.toString().trim(),
      condition: condition.toString().trim(),
      description: description.toString().trim(),
      askingPrice: Number(price),
      platformFee: Number(platformFeePercentage),
      finalPrice: Number(finalPrice),
      images: imageUrls,
      seller: req.user.userId,
      status: 'active'
    };

    // ✅ Add optional fields
    if (purchaseYear && !isNaN(parseInt(purchaseYear))) {
      productData.purchaseYear = parseInt(purchaseYear);
    }

    console.log('📦 FINAL Product Data:', productData);

    // ✅ Create and save product
    console.log('💾 Creating product in database...');
    const product = new Product(productData);
    const savedProduct = await product.save();
    
    console.log('✅ Product saved successfully! ID:', savedProduct._id);
    console.log('=== ✅ CREATE PRODUCT SUCCESS ===');

    res.status(201).json({
      success: true,
      message: 'Product listed successfully!',
      product: {
        id: savedProduct._id,
        productName: savedProduct.productName,
        brand: savedProduct.brand,
        finalPrice: savedProduct.finalPrice,
        images: savedProduct.images
      }
    });

  } catch (error) {
    console.error('=== ❌ CREATE PRODUCT ERROR ===');
    console.error('Error Name:', error.name);
    console.error('Error Message:', error.message);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed: ' + messages.join(', ')
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while creating product: ' + error.message
    });
  }
};

// ✅ GET USER PRODUCTS
const getUserProducts = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const products = await Product.find({ seller: userId })
      .sort({ createdAt: -1 })
      .populate('seller', 'name email username');

    res.status(200).json({
      success: true,
      products: products
    });
  } catch (error) {
    console.error('Get User Products Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
};

// ✅ GET ALL PRODUCTS (Public)
const getAllProducts = async (req, res) => {
  try {
    const { page = 1, limit = 10, category, search } = req.query;
    
    let query = { status: 'active', expiresAt: { $gt: new Date() } };
    
    if (category) {
      query.category = category;
    }
    
    if (search) {
      query.$or = [
        { productName: { $regex: search, $options: 'i' } },
        { brand: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const products = await Product.find(query)
      .populate('seller', 'name email avatar username')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Product.countDocuments(query);

    res.status(200).json({
      success: true,
      products,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Get All Products Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
};

// ✅ GET PRODUCTS BY CATEGORY
const getProductsByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const { page = 1, limit = 10 } = req.query;
    
    console.log('🎯 Fetching products for category:', category);
    
    // Build query - case insensitive search
    let query = { 
      status: 'active', 
      expiresAt: { $gt: new Date() },
      category: new RegExp(category, 'i')
    };

    // Find products
    const products = await Product.find(query)
      .populate('seller', 'name email avatar username')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Product.countDocuments(query);

    console.log(`✅ Found ${products.length} products for category: ${category}`);

    res.status(200).json({
      success: true,
      products,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
      category
    });
  } catch (error) {
    console.error('Get Products By Category Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
};

// ✅ GET SINGLE PRODUCT
const getProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('seller', 'name email avatar phone username');

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.status(200).json({
      success: true,
      product
    });
  } catch (error) {
    console.error('Get Product Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
};

// ✅ UPDATE PRODUCT - UPDATED WITH ADMIN SUPPORT
const updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // ✅ GET USER DETAILS TO CHECK ADMIN ROLE
    const user = await User.findById(req.user.userId);
    
    // ✅ CHECK IF USER IS ADMIN OR PRODUCT OWNER
    const isAdmin = user.role === 'admin';
    const isOwner = product.seller.toString() === req.user.userId;

    console.log('🔐 Update Authorization Check:', {
      userId: req.user.userId,
      sellerId: product.seller.toString(),
      userRole: user.role,
      isAdmin: isAdmin,
      isOwner: isOwner
    });

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this product'
      });
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      product: updatedProduct
    });
  } catch (error) {
    console.error('Update Product Error:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
};

// ✅ DELETE PRODUCT - UPDATED WITH ADMIN SUPPORT
const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // ✅ GET USER DETAILS TO CHECK ADMIN ROLE
    const user = await User.findById(req.user.userId);
    
    // ✅ CHECK IF USER IS ADMIN OR PRODUCT OWNER
    const isAdmin = user.role === 'admin';
    const isOwner = product.seller.toString() === req.user.userId;

    console.log('🔐 Delete Authorization Check:', {
      userId: req.user.userId,
      sellerId: product.seller.toString(),
      userRole: user.role,
      isAdmin: isAdmin,
      isOwner: isOwner
    });

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this product'
      });
    }

    await Product.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    console.error('Delete Product Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
};

// ✅ EXPORT ALL FUNCTIONS
export {
  createProduct,
  getUserProducts,
  getProduct,
  updateProduct,
  deleteProduct,
  getAllProducts,
  getProductsByCategory
};