import multer from "multer";

// ✅ MEMORY STORAGE for Vercel
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    console.log(`📄 File: ${file.originalname}, Type: ${file.mimetype}`);
    
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 5
  }
});

// Middleware wrapper
const uploadMiddleware = (req, res, next) => {
  upload.array('images', 5)(req, res, function (err) {
    if (err) {
      console.error('Upload error:', err);
      
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
      }
      
      return res.status(400).json({
        success: false,
        message: err.message || 'File upload error'
      });
    }
    
    console.log(`✅ Files processed: ${req.files ? req.files.length : 0}`);
    next();
  });
};

export default uploadMiddleware;