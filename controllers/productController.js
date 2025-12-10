// controllers/productController.js - COMPLETE UPDATED VERSION
import Product from "../models/Product.js";
import User from "../models/User.js";
import { v2 as cloudinary } from 'cloudinary';

// ✅ CREATE PRODUCT
const createProduct = async (req, res) => {
  console.log('=== 🚨 CREATE PRODUCT START ===');
  
  try {
    // ✅ SAFE: Access request data
    const body = req.body || {};
    const files = req.files || [];
    const user = req.user || {};
    
    console.log('📥 Request received:', {
      hasBody: !!body,
      hasFiles: files.length > 0,
      hasUser: !!user.userId,
      bodyKeys: Object.keys(body)
    });

    // ✅ Validate authentication
    if (!user.userId) {
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
    
    const missingFields = requiredFields.filter(field => !body[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}`
      });
    }

    // ✅ Extract fields safely
    const productName = String(body.productName || '').trim();
    const brand = String(body.brand || '').trim();
    const category = String(body.category || '').trim();
    const productType = String(body.productType || '').trim();
    const condition = String(body.condition || '').trim();
    const description = String(body.description || '').trim();
    const askingPrice = body.askingPrice || '0';
    const purchaseYear = body.purchaseYear || '';

    // ✅ Validate images
    if (files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one product image is required'
      });
    }

    console.log('✅ Validations passed');

    // ✅ Calculate price
    const price = parseFloat(askingPrice);
    if (isNaN(price) || price <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid asking price'
      });
    }

    // ✅ Platform fee calculation
    let platformFeePercentage = 15;
    if (price <= 2000) platformFeePercentage = 30;
    else if (price <= 5000) platformFeePercentage = 28;
    else if (price <= 10000) platformFeePercentage = 25;
    else if (price <= 15000) platformFeePercentage = 20;

    const feeAmount = (price * platformFeePercentage) / 100;
    const finalPrice = Math.ceil(price + feeAmount);

    console.log('💰 Price calculation:', { price, platformFeePercentage, finalPrice });

    // ✅ UPLOAD IMAGES
    console.log('🖼️ Starting image upload...');
    const imageUrls = [];
    const cloudinaryConfig = {
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET
    };

    const isCloudinaryConfigured = cloudinaryConfig.cloud_name && 
                                   cloudinaryConfig.api_key && 
                                   cloudinaryConfig.api_secret;

    console.log('☁️ Cloudinary configured:', isCloudinaryConfigured);
    
    for (const [index, file] of files.entries()) {
      try {
        if (!file.buffer) {
          console.log('⚠️ File has no buffer');
          continue;
        }

        let imageUrl = '';
        
        if (isCloudinaryConfigured) {
          // Upload to Cloudinary
          const b64 = Buffer.from(file.buffer).toString('base64');
          const dataURI = `data:${file.mimetype};base64,${b64}`;
          
          console.log(`📤 Uploading image ${index + 1}/${files.length} to Cloudinary...`);
          
          const result = await cloudinary.uploader.upload(dataURI, {
            folder: 'justbecho/products',
            resource_type: 'image'
          });
          
          imageUrl = result.secure_url;
          console.log(`✅ Cloudinary upload successful: ${file.originalname}`);
        } else {
          // Fallback to placeholder
          const placeholders = [
            'https://images.unsplash.com/photo-1546069901-ba9599a7e63c',
            'https://images.unsplash.com/photo-1565958011703-44f9829ba187',
            'https://images.unsplash.com/photo-1482049016688-2d3e1b311543'
          ];
          imageUrl = placeholders[Math.floor(Math.random() * placeholders.length)];
          console.log(`⚠️ Cloudinary not configured. Using placeholder for: ${file.originalname}`);
        }
        
        imageUrls.push({
          url: imageUrl,
          publicId: null,
          isPrimary: imageUrls.length === 0
        });
        
      } catch (uploadError) {
        console.error(`❌ Image ${index + 1} upload failed:`, uploadError.message);
        
        // If Cloudinary error, use placeholder
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
        
        console.log(`✅ Using fallback image for ${file.originalname}`);
      }
    }

    if (imageUrls.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Failed to process any images'
      });
    }

    console.log(`✅ Processed ${imageUrls.length} images`);

    // ✅ Get seller info
    const seller = await User.findById(user.userId).select('name email username');
    if (!seller) {
      return res.status(404).json({
        success: false,
        message: 'Seller not found'
      });
    }

    // ✅ Prepare product data
    const productData = {
      productName,
      brand,
      category,
      productType,
      condition,
      description,
      askingPrice: price,
      platformFee: platformFeePercentage,
      finalPrice,
      images: imageUrls,
      seller: user.userId,
      sellerName: seller.name || seller.email.split('@')[0],
      sellerUsername: seller.username || '',
      status: 'active',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    };

    // ✅ Add optional fields
    if (purchaseYear && !isNaN(parseInt(purchaseYear))) {
      productData.purchaseYear = parseInt(purchaseYear);
    }

    // ✅ Create and save product
    const product = new Product(productData);
    const savedProduct = await product.save();
    
    console.log('✅ Product created:', savedProduct._id);
    console.log('=== ✅ CREATE PRODUCT SUCCESS ===');

    res.status(201).json({
      success: true,
      message: 'Product listed successfully!',
      product: {
        id: savedProduct._id,
        productName: savedProduct.productName,
        brand: savedProduct.brand,
        finalPrice: savedProduct.finalPrice,
        images: savedProduct.images.map(img => img.url),
        sellerName: savedProduct.sellerName,
        status: savedProduct.status
      }
    });

  } catch (error) {
    console.error('=== ❌ CREATE PRODUCT ERROR ===');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    
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
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    const products = await Product.find({ seller: userId })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      products: products.map(product => ({
        id: product._id,
        productName: product.productName,
        brand: product.brand,
        category: product.category,
        finalPrice: product.finalPrice,
        images: product.images.map(img => img.url),
        status: product.status,
        createdAt: product.createdAt,
        views: product.views,
        likes: product.likes
      }))
    });
  } catch (error) {
    console.error('Get User Products Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
};

// ✅ GET ALL PRODUCTS
const getAllProducts = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 12, 
      category, 
      brand, // ✅ Added brand parameter
      search 
    } = req.query;
    
    let query = { status: 'active' };
    
    if (category && category !== 'all') {
      query.category = { $regex: new RegExp(category, 'i') };
    }
    
    if (brand && brand !== 'all') {
      query.brand = { $regex: new RegExp(brand, 'i') };
    }
    
    if (search) {
      query.$or = [
        { productName: { $regex: search, $options: 'i' } },
        { brand: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (page - 1) * limit;

    const products = await Product.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .select('productName brand category finalPrice images views likes createdAt condition');

    const total = await Product.countDocuments(query);

    res.status(200).json({
      success: true,
      products,
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
    const { page = 1, limit = 12, brand } = req.query;
    
    let query = { 
      status: 'active',
      category: { $regex: new RegExp(category, 'i') }
    };
    
    // ✅ Added brand filter
    if (brand && brand !== 'all') {
      query.brand = { $regex: new RegExp(brand, 'i') };
    }

    const skip = (page - 1) * limit;

    const products = await Product.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .select('productName brand category finalPrice images views likes createdAt condition');

    const total = await Product.countDocuments(query);

    res.status(200).json({
      success: true,
      products,
      category,
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

// ✅ GET PRODUCTS BY BRAND
const getProductsByBrand = async (req, res) => {
  try {
    const { brand } = req.params;
    const { category, page = 1, limit = 20 } = req.query;
    
    console.log('Fetching products for brand:', brand);
    console.log('Category filter:', category);
    
    let query = { 
      status: 'active',
      brand: { $regex: new RegExp(brand, 'i') }
    };
    
    // If category is provided, add it to filter
    if (category && category !== 'all') {
      query.category = { $regex: new RegExp(category, 'i') };
    }
    
    console.log('Query:', query);

    const skip = (page - 1) * limit;

    const products = await Product.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .select('productName brand category finalPrice images views likes createdAt condition');

    const total = await Product.countDocuments(query);
    
    console.log('Found products:', products.length);

    res.status(200).json({
      success: true,
      brand,
      category,
      products,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get Products By Brand Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
};

// ✅ GET ALL BRANDS
const getAllBrands = async (req, res) => {
  try {
    const brands = await Product.distinct('brand', { status: 'active' });
    
    const brandsWithCount = await Promise.all(
      brands.map(async (brand) => {
        const count = await Product.countDocuments({ 
          brand: { $regex: new RegExp(`^${brand}$`, 'i') },
          status: 'active'
        });
        return {
          name: brand,
          count: count
        };
      })
    );
    
    // Sort alphabetically
    const sortedBrands = brandsWithCount.sort((a, b) => 
      a.name.toLowerCase().localeCompare(b.name.toLowerCase())
    );
    
    // Filter out empty brands
    const filteredBrands = sortedBrands.filter(b => b.name && b.name.trim() !== '');

    res.status(200).json({
      success: true,
      brands: filteredBrands,
      total: filteredBrands.length
    });
  } catch (error) {
    console.error('Get All Brands Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
};

// ✅ GET SINGLE PRODUCT
const getProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Increment views
    product.views += 1;
    await product.save();

    // Get seller info
    const seller = await User.findById(product.seller)
      .select('name email username phone instaId sellerVerified');

    const productWithSeller = {
      ...product.toObject(),
      seller: seller ? {
        id: seller._id,
        name: seller.name,
        username: seller.username,
        phone: seller.phone,
        instaId: seller.instaId,
        sellerVerified: seller.sellerVerified
      } : null
    };

    res.status(200).json({
      success: true,
      product: productWithSeller
    });
  } catch (error) {
    console.error('Get Product Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
};

// ✅ UPDATE PRODUCT
const updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const user = req.user;
    const isOwner = product.seller.toString() === user.userId;
    const isAdmin = user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this product'
      });
    }

    const updateData = { ...req.body };
    
    // Handle image updates if files are provided
    if (req.files && req.files.length > 0) {
      const imageUrls = [];
      
      for (const file of req.files) {
        try {
          const cloudinaryConfig = {
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            api_key: process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET
          };

          if (cloudinaryConfig.cloud_name && cloudinaryConfig.api_key && 
              cloudinaryConfig.api_secret && file.buffer) {
            const b64 = Buffer.from(file.buffer).toString('base64');
            const dataURI = `data:${file.mimetype};base64,${b64}`;
            
            const result = await cloudinary.uploader.upload(dataURI, {
              folder: 'justbecho/products'
            });
            
            imageUrls.push({
              url: result.secure_url,
              publicId: result.public_id,
              isPrimary: imageUrls.length === 0
            });
          }
        } catch (uploadError) {
          console.error('Image upload error:', uploadError);
        }
      }
      
      if (imageUrls.length > 0) {
        updateData.images = imageUrls;
      }
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      updateData,
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

// ✅ DELETE PRODUCT
const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const user = req.user;
    const isOwner = product.seller.toString() === user.userId;
    const isAdmin = user.role === 'admin';

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

// ✅ GET FEATURED PRODUCTS
const getFeaturedProducts = async (req, res) => {
  try {
    const products = await Product.find({ 
      status: 'active'
    })
      .sort({ views: -1, likes: -1 })
      .limit(8)
      .select('productName brand finalPrice images views likes condition');

    res.status(200).json({
      success: true,
      products
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
    const { q, brand, category, limit = 20 } = req.query;
    
    let query = { status: 'active' };
    
    if (brand && brand !== 'all') {
      query.brand = { $regex: new RegExp(brand, 'i') };
    }
    
    if (category && category !== 'all') {
      query.category = { $regex: new RegExp(category, 'i') };
    }
    
    if (q) {
      query.$or = [
        { productName: { $regex: q, $options: 'i' } },
        { brand: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { category: { $regex: q, $options: 'i' } }
      ];
    }

    const products = await Product.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .select('productName brand category finalPrice images views likes createdAt condition');

    res.status(200).json({
      success: true,
      products,
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

// ✅ TEST CLOUDINARY ENDPOINT
const testCloudinary = async (req, res) => {
  try {
    const cloudinaryConfig = {
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET
    };

    const isConfigured = cloudinaryConfig.cloud_name && 
                         cloudinaryConfig.api_key && 
                         cloudinaryConfig.api_secret;

    if (!isConfigured) {
      return res.json({
        success: false,
        message: 'Cloudinary not configured',
        env_variables: {
          CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || 'not set',
          CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY ? 'set (hidden)' : 'not set',
          CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET ? 'set (hidden)' : 'not set'
        }
      });
    }

    // Test upload
    const testImage = 'https://res.cloudinary.com/demo/image/upload/sample.jpg';
    
    try {
      const result = await cloudinary.uploader.upload(testImage, {
        folder: 'justbecho/test'
      });

      res.json({
        success: true,
        message: 'Cloudinary is working!',
        test: {
          uploaded: true,
          url: result.secure_url,
          public_id: result.public_id
        },
        config: {
          cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
          api_key_set: !!process.env.CLOUDINARY_API_KEY,
          api_secret_set: !!process.env.CLOUDINARY_API_SECRET
        }
      });
    } catch (uploadError) {
      res.status(500).json({
        success: false,
        message: 'Cloudinary upload failed',
        error: uploadError.message,
        config: cloudinaryConfig
      });
    }

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Test failed',
      error: error.message
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
  getProductsByBrand,
  getAllBrands, // ✅ New function
  getFeaturedProducts,
  searchProducts,
  testCloudinary
};