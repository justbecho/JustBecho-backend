// middleware/uploadMiddleware.js - FIXED VERSION
import multer from "multer";

console.log('🔄 Upload Middleware Initialized');

// ✅ MEMORY STORAGE
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    // Check MIME type
    if (file.mimetype && file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 5 // Max 5 files
  }
});

const uploadMiddleware = (req, res, next) => {
  console.log('📤 Upload middleware processing request...');
  
  upload.array('images', 5)(req, res, function (err) {
    if (err) {
      console.error('❌ Upload error:', err.message);
      
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
      
      return res.status(400).json({
        success: false,
        message: `File upload error: ${err.message}`
      });
    }
    
    // ✅ SAFE: Check if files were uploaded
    if (req.files && Array.isArray(req.files)) {
      console.log(`✅ Upload successful: ${req.files.length} files received`);
    } else {
      console.log('⚠️ No files received');
      req.files = []; // Ensure it's always an array
    }
    
    next();
  });
};

export default uploadMiddleware;