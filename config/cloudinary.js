import { v2 as cloudinary } from 'cloudinary';

// Cloudinary configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dagf7likh',
  api_key: process.env.CLOUDINARY_API_KEY || '768369375187695',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'jgdKzVHSx0G7LATAOZP2hbZh4KQ',
  secure: true
});

console.log('🔑 Cloudinary Config Loaded');
console.log('Cloud Name:', cloudinary.config().cloud_name);

export default cloudinary;