import multer from "multer";

// ✅ MEMORY STORAGE for Vercel
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    console.log(`📄 File received: ${file.originalname}, Type: ${file.mimetype}`);
    
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      console.log(`❌ Rejected file type: ${file.mimetype}`);
      cb(new Error('Only image files are allowed!'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 5
  }
});

// Middleware wrapper
const uploadMiddleware = (req, res, next) => {
  console.log('=== 📤 UPLOAD MIDDLEWARE START ===');
  console.log('Request headers:', req.headers['content-type']);
  
  upload.array('images', 5)(req, res, function (err) {
    if (err) {
      console.error('❌ Upload middleware error:', err.message);
      console.error('Error code:', err.code);
      
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            message: 'File too large. Maximum size is 10MB.'
          });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({
            success: false,
            message: 'Too many files. Maximum 5 images allowed.'
          });
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          return res.status(400).json({
            success: false,
            message: 'Unexpected file field.'
          });
        }
      }
      
      return res.status(400).json({
        success: false,
        message: err.message || 'File upload error'
      });
    }
    
    console.log(`✅ Files processed: ${req.files ? req.files.length : 0}`);
    if (req.files) {
      req.files.forEach((file, i) => {
        console.log(`  File ${i + 1}: ${file.originalname}, Size: ${file.size} bytes`);
      });
    }
    console.log('=== ✅ UPLOAD MIDDLEWARE END ===');
    
    next();
  });
};

export default uploadMiddleware;