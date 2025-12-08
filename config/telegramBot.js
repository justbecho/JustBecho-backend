import TelegramBot from 'node-telegram-bot-api';
import User from '../models/User.js';
import { Server } from 'socket.io';
import http from 'http';
import express from 'express';

// ✅ TELEGRAM CREDENTIALS
const token = '8478776735:AAGW_4rg8BeSy29xDLQrDCZA1pDolRxZUuk';
const adminGroupId = '-1003318330957';

console.log('🤖 Initializing Telegram Bot: JustBechoBot');

let bot = null;
let io = null;

// ✅ Setup Socket.IO for real-time updates
export const setupSocketIO = (server) => {
  io = new Server(server, {
    cors: {
      origin: "http://localhost:3000",
      methods: ["GET", "POST"]
    }
  });

  io.on('connection', (socket) => {
    console.log('🔌 User connected to Socket.IO:', socket.id);
    
    socket.on('join-seller-room', (sellerId) => {
      socket.join(`seller-${sellerId}`);
      console.log(`👤 Seller ${sellerId} joined room`);
    });
    
    socket.on('disconnect', () => {
      console.log('🔌 User disconnected:', socket.id);
    });
  });

  return io;
};

// ✅ Send real-time notification to seller
export const sendRealTimeNotification = (sellerId, message, data = {}) => {
  if (io) {
    io.to(`seller-${sellerId}`).emit('seller-notification', {
      type: 'seller-status-update',
      message,
      data,
      timestamp: new Date().toISOString()
    });
    console.log(`📢 Real-time notification sent to seller ${sellerId}`);
  }
};

try {
  bot = new TelegramBot(token, { polling: true });
  console.log('✅ Bot instance created successfully');
} catch (error) {
  console.error('❌ Failed to create bot:', error.message);
  bot = null;
}

// Generate verification ID
const generateVerificationId = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substr(2, 6).toUpperCase();
  return `VER${timestamp}${random}`;
};

// ✅ Send verification request for seller approval
export const sendSellerVerificationToAdmin = async (user) => {
  try {
    console.log('\n📤 Sending seller verification to admin...');
    console.log('📱 User email:', user.email);
    console.log('💰 Bank details:', user.bankDetails);
    
    if (!bot || !adminGroupId) {
      console.log('❌ Bot not initialized');
      return null;
    }

    const verificationId = generateVerificationId();
    
    // ✅ FIX: Check if username already exists and clean it
    let displayUsername = 'Not set yet';
    if (user.username) {
      // Remove leading @ for storage
      displayUsername = user.username.replace(/^@+/, '');
    }
    
    const messageText = `
🆕 SELLER VERIFICATION REQUEST
━━━━━━━━━━━━━━━━━━━━
📧 **Email:** ${user.email}
👤 **Name:** ${user.name || 'N/A'}
📱 **Phone:** ${user.phone || 'N/A'}
👤 **Username:** @${displayUsername} ✅

🏠 **ADDRESS:**
${user.address?.street || 'N/A'}
${user.address?.city || ''}, ${user.address?.state || ''}
📌 ${user.address?.pincode || ''}

💰 **BANK DETAILS:**
• Account Name: ${user.bankDetails?.accountName || 'N/A'}
• Account Number: ${user.bankDetails?.accountNumber || 'N/A'}
• IFSC Code: ${user.bankDetails?.ifscCode || 'N/A'}

🆔 **Verification ID:** ${verificationId}
⏰ **Submitted:** ${new Date().toLocaleString('en-IN')}
━━━━━━━━━━━━━━━━━━━━
    `;

    console.log('📤 Sending to Group:', adminGroupId);
    
    try {
      const sentMessage = await bot.sendMessage(adminGroupId, messageText, {
        parse_mode: 'Markdown'
      });
      
      console.log('✅ Message sent, ID:', sentMessage.message_id);
      
      // Send commands message
      const commandsText = `
🔧 **APPROVAL COMMANDS:**
━━━━━━━━━━━━━━━━━━━━
✅ Approve: \`/approve_${verificationId}\`
❌ Reject: \`/reject_${verificationId}\`
👁️ View: \`/view_${verificationId}\`
━━━━━━━━━━━━━━━━━━━━
      `;
      
      await bot.sendMessage(adminGroupId, commandsText, {
        reply_to_message_id: sentMessage.message_id,
        parse_mode: 'Markdown'
      });
      
      return {
        success: true,
        verificationId: verificationId,
        messageId: sentMessage.message_id
      };
      
    } catch (error) {
      console.error('❌ Failed to send Telegram message:', error.message);
      return null;
    }
    
  } catch (error) {
    console.error('❌ Telegram error:', error);
    return null;
  }
};

// ✅ Handle approve command with real-time notification
const handleApproveCommand = async (chatId, verificationId, msg) => {
  console.log(`\n✅ /approve command: ${verificationId}`);
  
  try {
    const user = await User.findOne({
      verificationId: verificationId
    });
    
    if (!user) {
      bot.sendMessage(chatId, `❌ Verification ID "${verificationId}" not found.`);
      return;
    }
    
    // Check if already approved
    if (user.sellerVerified) {
      await bot.sendMessage(chatId, `✅ ${user.email} is already approved.`);
      return;
    }
    
    // ✅ FIX: Username ko clean karein (remove leading @)
    let username = user.username || '';
    
    if (!username || username.trim() === '') {
      // Generate new username
      const baseUsername = user.name.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
      username = `${baseUsername}@justbecho`;
    } else {
      // Remove any @ prefix from existing username
      username = username.replace(/^@+/, '');
      
      // Ensure it ends with @justbecho
      if (!username.includes('@justbecho')) {
        const baseName = username.split('@')[0] || user.name.toLowerCase().replace(/\s+/g, '');
        username = `${baseName}@justbecho`;
      }
    }
    
    // Check for duplicate username
    const existingUserWithSameUsername = await User.findOne({ 
      username: username,
      _id: { $ne: user._id }
    });
    
    if (existingUserWithSameUsername) {
      const randomNum = Math.floor(1000 + Math.random() * 9000);
      const baseName = username.split('@')[0];
      username = `${baseName}${randomNum}@justbecho`;
    }
    
    // Update user as verified seller
    user.sellerVerified = true;
    user.sellerVerificationStatus = 'approved';
    user.username = username; // Store as "name@justbecho" (NO @ prefix)
    user.verifiedAt = new Date();
    
    await user.save();
    
    console.log(`✅ Seller approved: ${user.email}`);
    console.log(`👤 Username set: ${username}`);
    
    // ✅ Send approval message to admin
    await bot.sendMessage(chatId, 
      `🎉 SELLER APPROVED!\n\n` +
      `✅ Email: ${user.email}\n` +
      `👤 Name: ${user.name || 'N/A'}\n` +
      `🆔 Username: @${username}\n` + // Display with @ for Telegram
      `⏰ Approved: ${new Date().toLocaleString('en-IN')}\n\n` +
      `📍 Seller can now list products on JustBecho!`
    );
    
    // ✅ SEND REAL-TIME NOTIFICATION TO SELLER
    sendRealTimeNotification(user._id, 'Your seller account has been approved!', {
      sellerVerified: true,
      sellerVerificationStatus: 'approved',
      username: username, // Store without @ prefix
      verificationId: verificationId
    });
    
    console.log(`📢 Real-time notification sent to seller ${user.email}`);
    
  } catch (error) {
    console.error('❌ Approve error:', error);
    bot.sendMessage(chatId, '❌ Error processing approval.');
  }
};

// ✅ Handle reject command with real-time notification
const handleRejectCommand = async (chatId, verificationId) => {
  console.log(`\n❌ /reject command: ${verificationId}`);
  
  try {
    const user = await User.findOne({
      verificationId: verificationId
    });
    
    if (!user) {
      bot.sendMessage(chatId, `❌ Verification ID "${verificationId}" not found.`);
      return;
    }
    
    // Update user as rejected
    user.sellerVerificationStatus = 'rejected';
    user.rejectedAt = new Date();
    
    await user.save();
    
    console.log(`❌ Seller rejected: ${user.email}`);
    
    // Send rejection message
    await bot.sendMessage(chatId, 
      `❌ SELLER REJECTED\n\n` +
      `📧 Email: ${user.email}\n` +
      `👤 Name: ${user.name || 'N/A'}\n` +
      `⏰ Rejected: ${new Date().toLocaleString('en-IN')}`
    );
    
    // ✅ SEND REAL-TIME NOTIFICATION TO SELLER
    sendRealTimeNotification(user._id, 'Your seller verification has been rejected.', {
      sellerVerified: false,
      sellerVerificationStatus: 'rejected',
      verificationId: verificationId
    });
    
  } catch (error) {
    console.error('❌ Reject error:', error);
    bot.sendMessage(chatId, '❌ Error processing rejection.');
  }
};

// ✅ Setup bot commands
if (bot) {
  console.log('🚀 Setting up bot commands...');
  
  // /start command
  bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const chatTitle = msg.chat.title || 'Private Chat';
    
    const response = `
🎉 JUSTBECHO BOT ACTIVATED!
━━━━━━━━━━━━━━━━━━━━
✅ Bot is WORKING!
📛 Chat: ${chatTitle}
🆔 ID: ${chatId}
⏰ Time: ${new Date().toLocaleString('en-IN')}
━━━━━━━━━━━━━━━━━━━━
🤖 I handle seller verification approvals
    `;
    
    bot.sendMessage(chatId, response);
  });
  
  // /approve command
  bot.onText(/\/approve_(.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const verificationId = match[1];
    await handleApproveCommand(chatId, verificationId, msg);
  });
  
  // /reject command
  bot.onText(/\/reject_(.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const verificationId = match[1];
    await handleRejectCommand(chatId, verificationId);
  });
  
  // /view command (optional)
  bot.onText(/\/view_(.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const verificationId = match[1];
    
    try {
      const user = await User.findOne({
        verificationId: verificationId
      }).select('email name phone address bankDetails sellerVerificationStatus username');
      
      if (!user) {
        bot.sendMessage(chatId, `❌ Verification ID "${verificationId}" not found.`);
        return;
      }
      
      // ✅ FIX: Clean username for display
      let displayUsername = user.username || 'Not set';
      if (displayUsername && displayUsername.startsWith('@')) {
        displayUsername = displayUsername.substring(1);
      }
      
      const detailsText = `
📋 SELLER DETAILS
━━━━━━━━━━━━━━━━━━━━
📧 Email: ${user.email}
👤 Name: ${user.name || 'N/A'}
📱 Phone: ${user.phone || 'N/A'}
👤 Username: @${displayUsername}
🏠 Address: ${user.address?.street || 'N/A'}, ${user.address?.city || ''}
💰 Bank: ${user.bankDetails?.accountName || 'N/A'} (${user.bankDetails?.accountNumber || 'N/A'})
📊 Status: ${user.sellerVerificationStatus || 'pending'}
🆔 ID: ${verificationId}
      `;
      
      await bot.sendMessage(chatId, detailsText);
      
    } catch (error) {
      console.error('❌ View error:', error);
      bot.sendMessage(chatId, '❌ Error fetching details.');
    }
  });
  
  // Send startup message
  setTimeout(async () => {
    try {
      await bot.sendMessage(
        adminGroupId,
        '🚀 JustBecho Bot Started!\n\n' +
        '✅ Ready to receive seller verification requests.\n' +
        '⏰ Time: ' + new Date().toLocaleString('en-IN')
      );
    } catch (error) {
      console.error('❌ Startup message failed:', error.message);
    }
  }, 3000);
  
  console.log('✅ Bot setup complete\n');
}

export { bot, io };
