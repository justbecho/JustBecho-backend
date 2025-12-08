import Product from "../models/Product.js";
import User from "../models/User.js";
import { v2 as cloudinary } from 'cloudinary';

// ✅ CLOUDINARY CONFIGURATION CHECK
console.log('☁️ Cloudinary Config Check:');
console.log('   Cloud Name:', process.env.CLOUDINARY_CLOUD_NAME ? '✅ Set' : '❌ Missing');
console.log('   API Key:', process.env.CLOUDINARY_API_KEY ? '✅ Set' : '❌ Missing');
console.log('   API Secret:', process.env.CLOUDINARY_API_SECRET ? '✅ Set' : '❌ Missing');

// ✅ CREATE PRODUCT - WITH FALLBACK OPTIONS
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

    // ✅ Calculate platform fee and final price
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

    // ✅ UPLOAD IMAGES WITH FALLBACK
    console.log('🖼️ Starting image upload...');
    const imageUrls = [];

    for (const file of req.files) {
      try {
        console.log(`📤 Uploading image: ${file.originalname}`);
        
        // Check Cloudinary configuration
        if (!process.env.CLOUDINARY_CLOUD_NAME || 
            !process.env.CLOUDINARY_API_KEY || 
            !process.env.CLOUDINARY_API_SECRET) {
          throw new Error('Cloudinary configuration missing');
        }

        // Convert buffer to base64
        const b64 = Buffer.from(file.buffer).toString('base64');
        const dataURI = `data:${file.mimetype};base64,${b64}`;
        
        // Upload to Cloudinary with timeout
        const uploadPromise = cloudinary.uploader.upload(dataURI, {
          folder: 'justbecho/products',
          use_filename: true,
          unique_filename: true,
          resource_type: 'auto',
          transformation: [{ width: 1000, height: 1000, crop: 'limit' }]
        });

        // Add timeout to prevent hanging
        const result = await Promise.race([
          uploadPromise,
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Cloudinary upload timeout')), 30000)
          )
        ]);

        console.log(`✅ Image uploaded to Cloudinary: ${result.secure_url}`);
        
        imageUrls.push({
          url: result.secure_url,
          publicId: result.public_id,
          isPrimary: imageUrls.length === 0
        });

      } catch (uploadError) {
        console.error(`❌ Cloudinary upload failed for ${file.originalname}:`, uploadError.message);
        
        // FALLBACK: Use placeholder image
        const fallbackImages = [
          'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1000',
          'https://images.unsplash.com/photo-1565958011703-44f9829ba187?auto=format&fit=crop&w=1000',
          'https://images.unsplash.com/photo-1482049016688-2d3e1b311543?auto=format&fit=crop&w=1000'
        ];
        
        const randomIndex = Math.floor(Math.random() * fallbackImages.length);
        imageUrls.push({
          url: fallbackImages[randomIndex],
          publicId: null,
          isPrimary: imageUrls.length === 0
        });
        
        console.log(`⚠️ Using fallback image for ${file.originalname}`);
      }
    }

    if (imageUrls.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Failed to process any images'
      });
    }

    console.log('✅ Images processed:', imageUrls.length);

    // ✅ Get seller info
    const seller = await User.findById(req.user.userId).select('name email username');
    if (!seller) {
      return res.status(404).json({
        success: false,
        message: 'Seller not found'
      });
    }

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
      sellerName: seller.name || seller.email.split('@')[0],
      sellerUsername: seller.username || '',
      status: 'active',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
    };

    // ✅ Add optional fields
    if (purchaseYear && !isNaN(parseInt(purchaseYear))) {
      productData.purchaseYear = parseInt(purchaseYear);
    }

    console.log('📦 Product Data to save:', {
      ...productData,
      images: `[${imageUrls.length} images]`
    });

    // ✅ Create and save product
    const product = new Product(productData);
    const savedProduct = await product.save();
    
    console.log('✅ Product saved! ID:', savedProduct._id);
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
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
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

// ✅ GET ALL PRODUCTS (Public)
const getAllProducts = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 12, 
      category, 
      search, 
      minPrice, 
      maxPrice,
      sort = 'newest' 
    } = req.query;
    
    let query = { status: 'active' };
    
    if (category && category !== 'all') {
      query.category = { $regex: new RegExp(category, 'i') };
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
    let sortOption = { createdAt: -1 };
    if (sort === 'price-low') sortOption = { finalPrice: 1 };
    if (sort === 'price-high') sortOption = { finalPrice: -1 };
    if (sort === 'popular') sortOption = { views: -1 };

    const skip = (page - 1) * limit;

    const products = await Product.find(query)
      .sort(sortOption)
      .skip(skip)
      .limit(Number(limit))
      .select('productName brand category finalPrice images views likes createdAt');

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
    const { page = 1, limit = 12 } = req.query;
    
    console.log('🎯 Fetching products for category:', category);
    
    let query = { 
      status: 'active',
      category: { $regex: new RegExp(category, 'i') }
    };

    const skip = (page - 1) * limit;

    const products = await Product.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .select('productName brand category finalPrice images views likes createdAt');

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

    const user = await User.findById(req.user.userId);
    
    const isAdmin = user?.role === 'admin';
    const isOwner = product.seller.toString() === req.user.userId;

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this product'
      });
    }

    // Update fields
    const updateData = { ...req.body };
    
    // If updating images
    if (req.files && req.files.length > 0) {
      const imageUrls = [];
      
      for (const file of req.files) {
        try {
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

    const user = await User.findById(req.user.userId);
    
    const isAdmin = user?.role === 'admin';
    const isOwner = product.seller.toString() === req.user.userId;

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this product'
      });
    }

    // Delete images from Cloudinary if publicId exists
    if (product.images && product.images.length > 0) {
      for (const image of product.images) {
        if (image.publicId) {
          try {
            await cloudinary.uploader.destroy(image.publicId);
          } catch (cloudinaryError) {
            console.error('Error deleting from Cloudinary:', cloudinaryError);
          }
        }
      }
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
      .select('productName brand finalPrice images views likes');

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
    const { q, category, minPrice, maxPrice, limit = 20 } = req.query;
    
    let query = { status: 'active' };
    
    if (q) {
      query.$or = [
        { productName: { $regex: q, $options: 'i' } },
        { brand: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { category: { $regex: q, $options: 'i' } }
      ];
    }
    
    if (category && category !== 'all') {
      query.category = category;
    }
    
    if (minPrice) {
      query.finalPrice = { $gte: Number(minPrice) };
    }
    
    if (maxPrice) {
      query.finalPrice = { ...query.finalPrice, $lte: Number(maxPrice) };
    }

    const products = await Product.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .select('productName brand category finalPrice images views likes createdAt');

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
  searchProducts
};