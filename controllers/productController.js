import Product from "../models/Product.js";
import User from "../models/User.js";
import cloudinary from './config/cloudinary.js';

// ✅ CREATE PRODUCT - WITH CLOUDINARY & FALLBACK
const createProduct = async (req, res) => {
  console.log('=== 🚨 CREATE PRODUCT REQUEST START ===');
  
  try {
    console.log('📥 Request Body:', req.body);
    console.log('📸 Files count:', req.files ? req.files.length : 0);
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

    // ✅ Validate images
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one product image is required'
      });
    }

    console.log('✅ All validations passed');

    // ✅ Parse price
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

    const feeAmount = (price * platformFeePercentage) / 100;
    const finalPrice = Math.ceil(price + feeAmount);

    console.log('💰 FINAL Price Calculation:', {
      askingPrice: price,
      platformFee: platformFeePercentage,
      feeAmount: feeAmount,
      finalPrice: finalPrice
    });

    // ✅ UPLOAD IMAGES - CLOUDINARY WITH FALLBACK
    console.log('☁️ Starting image upload...');
    const imageUrls = [];

    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      try {
        console.log(`📤 Uploading image ${i + 1}/${req.files.length}: ${file.originalname}`);
        
        // Convert buffer to base64 for Cloudinary
        const b64 = Buffer.from(file.buffer).toString('base64');
        const dataURI = `data:${file.mimetype};base64,${b64}`;
        
        // Try Cloudinary upload
        console.log('🔄 Attempting Cloudinary upload...');
        const result = await cloudinary.uploader.upload(dataURI, {
          folder: 'justbecho/products',
          use_filename: true,
          unique_filename: true,
          transformation: [{ width: 1000, height: 1000, crop: 'limit' }]
        });

        console.log(`✅ Cloudinary upload successful: ${result.secure_url}`);
        
        imageUrls.push({
          url: result.secure_url,
          publicId: result.public_id,
          isPrimary: i === 0,
          uploadedVia: 'cloudinary'
        });

      } catch (uploadError) {
        console.error(`❌ Cloudinary upload failed: ${uploadError.message}`);
        
        // ✅ FALLBACK: Store as base64
        console.log(`🔄 Using fallback (base64) for: ${file.originalname}`);
        const b64 = Buffer.from(file.buffer).toString('base64');
        const dataURI = `data:${file.mimetype};base64,${b64}`;
        
        // Check if base64 is too large (MongoDB has 16MB limit)
        const sizeKB = Math.round(b64.length / 1024);
        if (sizeKB > 10000) { // 10MB limit for base64
          console.log(`⚠️ Base64 too large (${sizeKB}KB), skipping image`);
          continue;
        }
        
        imageUrls.push({
          url: dataURI,
          publicId: `base64_${Date.now()}_${i}`,
          isPrimary: i === 0,
          uploadedVia: 'base64',
          sizeKB: sizeKB
        });
        
        console.log(`✅ Stored as base64 (${sizeKB}KB)`);
      }
    }

    // ✅ Check if we have at least one image
    if (imageUrls.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Failed to process any images. Please try again.'
      });
    }

    console.log(`🖼️ Total images processed: ${imageUrls.length}`);

    // ✅ Create product data
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
      status: 'active',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    };

    // ✅ Add optional fields
    if (purchaseYear && !isNaN(parseInt(purchaseYear))) {
      productData.purchaseYear = parseInt(purchaseYear);
    }

    console.log('📦 Final Product Data:', {
      productName: productData.productName,
      category: productData.category,
      price: productData.finalPrice,
      imageCount: productData.images.length
    });

    // ✅ Create and save product
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
        images: savedProduct.images.map(img => ({
          url: img.url.substring(0, 50) + '...', // Truncate for response
          isPrimary: img.isPrimary
        })),
        category: savedProduct.category,
        status: savedProduct.status
      }
    });

  } catch (error) {
    console.error('=== ❌ CREATE PRODUCT ERROR ===');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed: ' + messages.join(', ')
      });
    }

    if (error.name === 'MongoError' && error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Product with similar details already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while creating product',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ✅ GET USER PRODUCTS
const getUserProducts = async (req, res) => {
  try {
    console.log('📦 Fetching user products for:', req.user.userId);
    
    const products = await Product.find({ seller: req.user.userId })
      .sort({ createdAt: -1 })
      .populate('seller', 'name email username')
      .lean();

    // Process images for response
    const processedProducts = products.map(product => ({
      ...product,
      images: product.images.map(img => ({
        url: img.url,
        isPrimary: img.isPrimary,
        uploadedVia: img.uploadedVia || 'unknown'
      }))
    }));

    res.status(200).json({
      success: true,
      count: processedProducts.length,
      products: processedProducts
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
    const { page = 1, limit = 20, category, search, minPrice, maxPrice, sort = 'newest' } = req.query;
    
    console.log('📦 Fetching all products with filters:', {
      page, limit, category, search, minPrice, maxPrice, sort
    });
    
    let query = { 
      status: 'active', 
      expiresAt: { $gt: new Date() } 
    };
    
    // Apply filters
    if (category && category !== 'all') {
      query.category = new RegExp(category, 'i');
    }
    
    if (search) {
      query.$or = [
        { productName: { $regex: search, $options: 'i' } },
        { brand: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (minPrice) {
      query.finalPrice = { $gte: Number(minPrice) };
    }
    
    if (maxPrice) {
      query.finalPrice = { ...query.finalPrice, $lte: Number(maxPrice) };
    }

    // Sorting
    let sortOption = { createdAt: -1 }; // newest first by default
    if (sort === 'price-low') sortOption = { finalPrice: 1 };
    if (sort === 'price-high') sortOption = { finalPrice: -1 };
    if (sort === 'popular') sortOption = { views: -1, likes: -1 };

    const skip = (page - 1) * limit;
    
    const products = await Product.find(query)
      .populate('seller', 'name email avatar username rating')
      .sort(sortOption)
      .limit(Number(limit))
      .skip(skip)
      .lean();

    const total = await Product.countDocuments(query);

    // Process images
    const processedProducts = products.map(product => ({
      ...product,
      images: product.images.slice(0, 1), // Only send first image for listing
      seller: product.seller ? {
        _id: product.seller._id,
        name: product.seller.name,
        username: product.seller.username,
        rating: product.seller.rating
      } : null
    }));

    res.status(200).json({
      success: true,
      products: processedProducts,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit)
      }
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
    const { page = 1, limit = 20 } = req.query;
    
    console.log('🎯 Fetching products for category:', category);
    
    let query = { 
      status: 'active', 
      expiresAt: { $gt: new Date() },
      category: new RegExp(category, 'i')
    };

    const skip = (page - 1) * limit;
    
    const products = await Product.find(query)
      .populate('seller', 'name email avatar username rating')
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip(skip)
      .lean();

    const total = await Product.countDocuments(query);

    // Process images
    const processedProducts = products.map(product => ({
      ...product,
      images: product.images.slice(0, 1) // Only first image
    }));

    res.status(200).json({
      success: true,
      products: processedProducts,
      category: category,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit)
      }
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
    const { id } = req.params;
    console.log('🔍 Fetching product:', id);
    
    const product = await Product.findById(id)
      .populate('seller', 'name email avatar phone username rating createdAt')
      .lean();

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Increment views
    await Product.findByIdAndUpdate(id, { $inc: { views: 1 } });

    res.status(200).json({
      success: true,
      product: {
        ...product,
        seller: product.seller ? {
          _id: product.seller._id,
          name: product.seller.name,
          email: product.seller.email,
          avatar: product.seller.avatar,
          phone: product.seller.phone,
          username: product.seller.username,
          rating: product.seller.rating,
          memberSince: product.seller.createdAt
        } : null
      }
    });
  } catch (error) {
    console.error('Get Product Error:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID format'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
};

// ✅ UPDATE PRODUCT
const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('✏️ Updating product:', id);
    
    const product = await Product.findById(id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const user = await User.findById(req.user.userId);
    
    const isAdmin = user.role === 'admin';
    const isOwner = product.seller.toString() === req.user.userId;

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this product'
      });
    }

    // Update fields
    const updates = { ...req.body };
    
    // Handle price updates - recalculate final price
    if (updates.askingPrice) {
      const price = parseFloat(updates.askingPrice);
      
      let platformFeePercentage = 0;
      if (price <= 2000) platformFeePercentage = 30;
      else if (price <= 5000) platformFeePercentage = 28;
      else if (price <= 10000) platformFeePercentage = 25;
      else if (price <= 15000) platformFeePercentage = 20;
      else platformFeePercentage = 15;

      const feeAmount = (price * platformFeePercentage) / 100;
      updates.finalPrice = Math.ceil(price + feeAmount);
      updates.platformFee = platformFeePercentage;
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      updates,
      { new: true, runValidators: true }
    ).populate('seller', 'name username');

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

// ✅ DELETE PRODUCT
const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🗑️ Deleting product:', id);
    
    const product = await Product.findById(id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const user = await User.findById(req.user.userId);
    
    const isAdmin = user.role === 'admin';
    const isOwner = product.seller.toString() === req.user.userId;

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this product'
      });
    }

    // Delete Cloudinary images if they exist
    if (product.images && product.images.length > 0) {
      for (const image of product.images) {
        if (image.uploadedVia === 'cloudinary' && image.publicId) {
          try {
            await cloudinary.uploader.destroy(image.publicId);
            console.log(`✅ Deleted from Cloudinary: ${image.publicId}`);
          } catch (cloudinaryError) {
            console.error('Error deleting from Cloudinary:', cloudinaryError);
          }
        }
      }
    }

    await Product.findByIdAndDelete(id);

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

// ✅ GET FEATURED PRODUCTS
const getFeaturedProducts = async (req, res) => {
  try {
    const products = await Product.find({ 
      status: 'active',
      expiresAt: { $gt: new Date() }
    })
      .sort({ views: -1, likes: -1, createdAt: -1 })
      .limit(12)
      .populate('seller', 'name username rating')
      .lean();

    const processedProducts = products.map(product => ({
      ...product,
      images: product.images.slice(0, 1) // Only first image
    }));

    res.status(200).json({
      success: true,
      products: processedProducts
    });
  } catch (error) {
    console.error('Get Featured Products Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
};

// ✅ SEARCH PRODUCTS
const searchProducts = async (req, res) => {
  try {
    const { q, category, minPrice, maxPrice, limit = 20 } = req.query;
    
    console.log('🔍 Searching products:', { q, category, minPrice, maxPrice });
    
    let query = { 
      status: 'active', 
      expiresAt: { $gt: new Date() } 
    };
    
    if (q) {
      query.$or = [
        { productName: { $regex: q, $options: 'i' } },
        { brand: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { category: { $regex: q, $options: 'i' } }
      ];
    }
    
    if (category && category !== 'all') {
      query.category = new RegExp(category, 'i');
    }
    
    if (minPrice) {
      query.finalPrice = { $gte: Number(minPrice) };
    }
    
    if (maxPrice) {
      query.finalPrice = { ...query.finalPrice, $lte: Number(maxPrice) };
    }

    const products = await Product.find(query)
      .populate('seller', 'name username')
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .lean();

    const processedProducts = products.map(product => ({
      ...product,
      images: product.images.slice(0, 1)
    }));

    res.status(200).json({
      success: true,
      products: processedProducts,
      count: products.length
    });
  } catch (error) {
    console.error('Search Products Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
};

// ✅ GET RECENT PRODUCTS
const getRecentProducts = async (req, res) => {
  try {
    const products = await Product.find({ 
      status: 'active',
      expiresAt: { $gt: new Date() }
    })
      .sort({ createdAt: -1 })
      .limit(8)
      .populate('seller', 'name username')
      .lean();

    res.status(200).json({
      success: true,
      products
    });
  } catch (error) {
    console.error('Get Recent Products Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
};

// ✅ CLOUDINARY TEST ENDPOINT
const testCloudinary = async (req, res) => {
  try {
    console.log('🧪 Testing Cloudinary connection...');
    
    // Test upload with sample image
    const result = await cloudinary.uploader.upload(
      'https://res.cloudinary.com/demo/image/upload/sample.jpg',
      { 
        folder: 'justbecho/test',
        public_id: `test_${Date.now()}`
      }
    );
    
    console.log('✅ Cloudinary test successful:', result.secure_url);
    
    // Cleanup
    await cloudinary.uploader.destroy(result.public_id);
    
    res.json({
      success: true,
      message: 'Cloudinary is working correctly!',
      cloudinary: {
        cloud_name: cloudinary.config().cloud_name,
        test_upload: 'successful',
        test_url: result.secure_url
      }
    });
  } catch (error) {
    console.error('❌ Cloudinary test failed:', error);
    res.status(500).json({
      success: false,
      message: 'Cloudinary error: ' + error.message,
      config: {
        cloud_name: cloudinary.config().cloud_name,
        api_key_set: !!cloudinary.config().api_key,
        error: error.message
      }
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
  getProductsByCategory,
  getFeaturedProducts,
  getRecentProducts,
  searchProducts,
  testCloudinary
};