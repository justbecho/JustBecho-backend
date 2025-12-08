// middleware/uploadMiddleware.js - ENHANCED VERSION
import multer from "multer";

console.log('🔄 Upload Middleware Initialized');

// ✅ MEMORY STORAGE (No local files - Vercel compatible)
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    console.log(`📄 File validation: ${file.originalname}, MIME: ${file.mimetype}`);
    
    // Check MIME type
    if (!file.mimetype.startsWith('image/')) {
      console.log(`❌ Rejected: Not an image - ${file.mimetype}`);
      return cb(new Error('Only image files are allowed!'), false);
    }
    
    // Check file extension
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg'];
    const fileExt = file.originalname.toLowerCase().match(/\.[0-9a-z]+$/i);
    
    if (!fileExt || !allowedExtensions.includes(fileExt[0])) {
      console.log(`❌ Rejected: Invalid extension - ${file.originalname}`);
      return cb(new Error('Only JPG, PNG, WebP, GIF, and SVG files are allowed!'), false);
    }
    
    console.log(`✅ Accepted: ${file.originalname}`);
    cb(null, true);
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 5, // Max 5 files
    fieldNameSize: 100, // Max field name size
    fieldSize: 10 * 1024 * 1024, // Max field value size (10MB)
    fields: 20 // Max number of non-file fields
  }
});

const uploadMiddleware = (req, res, next) => {
  console.log('=== 📤 UPLOAD MIDDLEWARE START ===');
  console.log('Headers:', {
    'content-type': req.headers['content-type'],
    'content-length': req.headers['content-length']
  });
  
  console.log('Body fields:', Object.keys(req.body));
  
  upload.array('images', 5)(req, res, function (err) {
    if (err) {
      console.error('❌ Multer Error:', {
        name: err.name,
        code: err.code,
        message: err.message,
        field: err.field
      });
      
      // Handle specific multer errors
      if (err instanceof multer.MulterError) {
        switch (err.code) {
          case 'LIMIT_FILE_SIZE':
            return res.status(400).json({
              success: false,
              message: 'File too large. Maximum size is 10MB per image.'
            });
          
          case 'LIMIT_FILE_COUNT':
            return res.status(400).json({
              success: false,
              message: 'Too many files. Maximum 5 images allowed.'
            });
          
          case 'LIMIT_FIELD_KEY':
            return res.status(400).json({
              success: false,
              message: 'Field name too long.'
            });
          
          case 'LIMIT_FIELD_VALUE':
            return res.status(400).json({
              success: false,
              message: 'Field value too large.'
            });
          
          case 'LIMIT_FIELD_COUNT':
            return res.status(400).json({
              success: false,
              message: 'Too many form fields.'
            });
          
          case 'LIMIT_UNEXPECTED_FILE':
            return res.status(400).json({
              success: false,
              message: 'Unexpected file field. Use "images" field for uploads.'
            });
          
          default:
            return res.status(400).json({
              success: false,
              message: `Upload error: ${err.message}`
            });
        }
      }
      
      // Handle other errors
      return res.status(400).json({
        success: false,
        message: `File upload error: ${err.message}`
      });
    }
    
    // Log upload success
    console.log('✅ Upload middleware success');
    console.log(`📸 Files received: ${req.files ? req.files.length : 0}`);
    
    if (req.files && req.files.length > 0) {
      req.files.forEach((file, index) => {
        console.log(`  ${index + 1}. ${file.originalname} (${file.size} bytes, ${file.mimetype})`);
      });
    } else {
      console.log('⚠️ No files received in upload middleware');
    }
    
    console.log('=== ✅ UPLOAD MIDDLEWARE END ===\n');
    next();
  });
};

export default uploadMiddleware;