// middleware/uploadMiddleware.js - UPDATED WITH 5MB LIMIT & HEIF SUPPORT
import multer from "multer";

console.log('🔄 Upload Middleware Initialized - 5MB LIMIT');

// ✅ MEMORY STORAGE
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    // ✅ UPDATED: Support HEIF/HEIC files
    const validMimeTypes = [
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/webp',
      'image/heif',
      'image/heic',
      'image/heif-sequence',
      'image/heic-sequence'
    ];
    
    // Check file extension for HEIF
    const fileExt = file.originalname.toLowerCase().split('.').pop();
    const isHEIF = fileExt === 'heif' || fileExt === 'heic';
    
    if (validMimeTypes.includes(file.mimetype) || isHEIF) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPG, PNG, WebP, HEIF/HEIC) are allowed!'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024, // ✅ 5MB per file
    files: 5, // Max 5 files
    parts: 20,
    headerPairs: 200
  }
});

const uploadMiddleware = (req, res, next) => {
  console.log('\n📤 ===== UPLOAD REQUEST START =====');
  console.log(`🌐 Method: ${req.method}, URL: ${req.url}`);
  console.log(`📊 Content-Type: ${req.headers['content-type']}`);
  console.log(`📦 Content-Length: ${req.headers['content-length'] ? `${(req.headers['content-length']/(1024*1024)).toFixed(2)}MB` : 'Unknown'}`);
  console.log(`👤 User: ${req.user?.id || 'Unknown'}`);
  console.log(`⚡ Limits: 5MB per file, 5 files max`);
  
  // ✅ Set longer timeout for uploads
  req.setTimeout(300000); // 5 minutes
  res.setTimeout(300000);
  
  upload.array('images', 5)(req, res, function (err) {
    if (err) {
      console.error('❌ UPLOAD ERROR DETAILS:');
      console.error('  Message:', err.message);
      console.error('  Code:', err.code);
      console.error('  Stack:', err.stack);
      
      if (err instanceof multer.MulterError) {
        switch (err.code) {
          case 'LIMIT_FILE_SIZE':
            console.error('  Detail: Individual file exceeds 5MB limit');
            return res.status(413).json({
              success: false,
              message: 'File too large. Maximum size is 5MB per image.',
              details: 'Each image must be under 5MB',
              limit: '5MB per file',
              code: 'FILE_TOO_LARGE'
            });
          
          case 'LIMIT_FILE_COUNT':
            return res.status(400).json({
              success: false,
              message: 'Too many files. Maximum 5 images allowed.',
              limit: 5,
              code: 'TOO_MANY_FILES'
            });
          
          case 'LIMIT_UNEXPECTED_FILE':
            return res.status(400).json({
              success: false,
              message: 'Unexpected file field. Use "images" field for uploads.',
              expectedField: 'images',
              code: 'UNEXPECTED_FIELD'
            });
          
          case 'LIMIT_PART_COUNT':
            return res.status(413).json({
              success: false,
              message: 'Request has too many parts. Try with fewer images.',
              code: 'TOO_MANY_PARTS'
            });
          
          case 'LIMIT_FIELD_KEY':
            return res.status(400).json({
              success: false,
              message: 'Field name too long.',
              code: 'FIELD_NAME_TOO_LONG'
            });
          
          case 'LIMIT_FIELD_VALUE':
            return res.status(400).json({
              success: false,
              message: 'Field value too long.',
              code: 'FIELD_VALUE_TOO_LONG'
            });
          
          case 'LIMIT_FIELD_COUNT':
            return res.status(400).json({
              success: false,
              message: 'Too many form fields.',
              code: 'TOO_MANY_FIELDS'
            });
          
          default:
            console.error('  Unknown Multer Error:', err.code);
            return res.status(400).json({
              success: false,
              message: `Upload error: ${err.message}`,
              code: err.code || 'UNKNOWN_MULTER_ERROR'
            });
        }
      }
      
      // Non-Multer errors
      return res.status(400).json({
        success: false,
        message: `File upload error: ${err.message}`,
        type: 'UPLOAD_ERROR',
        code: 'UPLOAD_FAILED'
      });
    }
    
    // ✅ SAFE: Check if files were uploaded
    if (req.files && Array.isArray(req.files)) {
      console.log(`✅ UPLOAD SUCCESS: ${req.files.length} files received`);
      
      let totalSize = 0;
      req.files.forEach((file, i) => {
        const sizeMB = file.size / (1024 * 1024);
        totalSize += file.size;
        console.log(`  📄 File ${i+1}: ${file.originalname}`);
        console.log(`     Size: ${sizeMB.toFixed(2)}MB`);
        console.log(`     Type: ${file.mimetype}`);
        console.log(`     Field: ${file.fieldname}`);
      });
      
      console.log(`  📦 Total size: ${(totalSize/(1024*1024)).toFixed(2)}MB`);
      console.log(`  ⏰ Request duration: ${Date.now() - req.startTime || 'Unknown'}ms`);
      
      // ✅ Add size validation (25MB total)
      const MAX_TOTAL_SIZE = 25 * 1024 * 1024; // 25MB total
      if (totalSize > MAX_TOTAL_SIZE) {
        console.error('❌ Total size exceeds 25MB limit');
        return res.status(413).json({
          success: false,
          message: 'Total upload size exceeds 25MB limit.',
          details: `Total: ${(totalSize/(1024*1024)).toFixed(2)}MB, Limit: 25MB`,
          limit: '25MB total',
          code: 'TOTAL_SIZE_EXCEEDED'
        });
      }
    } else {
      console.log('⚠️ No files received in this request');
      req.files = []; // Ensure it's always an array
    }
    
    console.log('📤 ===== UPLOAD REQUEST END =====\n');
    next();
  });
};

export default uploadMiddleware;