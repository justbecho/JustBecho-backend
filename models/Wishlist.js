import mongoose from 'mongoose';

const wishlistSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  products: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  }]
}, {
  timestamps: true
});

// Index for better performance
wishlistSchema.index({ user: 1 });

export default mongoose.model('Wishlist', wishlistSchema);
