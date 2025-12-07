import Product from "../models/Product.js";
import User from "../models/User.js";
import { v2 as cloudinary } from 'cloudinary';

// ✅ Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dagf7likh',
  api_key: process.env.CLOUDINARY_API_KEY || '768369375187695',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'jgdKzVHSx0G7LATAOZP2hbZh4KQ',
  secure: true
});

console.log('🌥️ Cloudinary initialized:', cloudinary.config().cloud_name);

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

    // ✅ UPLOAD IMAGES
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
        
        // Check size
        const sizeKB = Math.round(b64.length / 1024);
        if (sizeKB > 5000) { // 5MB limit
          console.log(`⚠️ Image too large (${sizeKB}KB), skipping`);
          continue;
        }
        
        imageUrls.push({
          url: dataURI,
          publicId: `base64_${Date.now()}_${i}`,
          isPrimary: i === 0,
          uploadedVia: 'base64'
        });
        
        console.log(`✅ Stored as base64 (${sizeKB}KB)`);
      }
    }

    // ✅ Check if we have images
    if (imageUrls.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Failed to process any images'
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
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    };

    // ✅ Add optional fields
    if (purchaseYear && !isNaN(parseInt(purchaseYear))) {
      productData.purchaseYear = parseInt(purchaseYear);
    }

    console.log('📦 Creating product...');

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
        images: savedProduct.images.map(img => ({
          url: img.url,
          isPrimary: img.isPrimary
        }))
      }
    });

  } catch (error) {
    console.error('=== ❌ CREATE PRODUCT ERROR ===');
    console.error('Error:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed: ' + messages.join(', ')
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
    const products = await Product.find({ seller: req.user.userId })
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

// ✅ GET ALL PRODUCTS
const getAllProducts = async (req, res) => {
  try {
    const { page = 1, limit = 20, category, search } = req.query;
    
    let query = { status: 'active', expiresAt: { $gt: new Date() } };
    
    if (category) {
      query.category = new RegExp(category, 'i');
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
      .limit(Number(limit))
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
    const { page = 1, limit = 20 } = req.query;
    
    let query = { 
      status: 'active', 
      expiresAt: { $gt: new Date() },
      category: new RegExp(category, 'i')
    };

    const products = await Product.find(query)
      .populate('seller', 'name email avatar username')
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((page - 1) * limit);

    const total = await Product.countDocuments(query);

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

    // Increment views
    product.views += 1;
    await product.save();

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
    
    const isAdmin = user.role === 'admin';
    const isOwner = product.seller.toString() === req.user.userId;

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
    
    const isAdmin = user.role === 'admin';
    const isOwner = product.seller.toString() === req.user.userId;

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this product'
      });
    }

    // Delete Cloudinary images
    if (product.images && product.images.length > 0) {
      for (const image of product.images) {
        if (image.uploadedVia === 'cloudinary' && image.publicId) {
          try {
            await cloudinary.uploader.destroy(image.publicId);
          } catch (error) {
            console.error('Error deleting from Cloudinary:', error);
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

// ✅ CLOUDINARY TEST
const testCloudinary = async (req, res) => {
  try {
    const result = await cloudinary.uploader.upload(
      'https://res.cloudinary.com/demo/image/upload/sample.jpg',
      { folder: 'test' }
    );
    
    await cloudinary.uploader.destroy(result.public_id);
    
    res.json({
      success: true,
      message: 'Cloudinary working!',
      cloud_name: cloudinary.config().cloud_name
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Cloudinary error: ' + error.message
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
  testCloudinary
};