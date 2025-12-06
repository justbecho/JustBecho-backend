// config/googleAuth.js - UPDATED VERSION
import dotenv from "dotenv";
dotenv.config();

import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import User from "../models/User.js";

console.log("GOOGLE ID:", process.env.GOOGLE_CLIENT_ID);
console.log("GOOGLE SECRET:", process.env.GOOGLE_CLIENT_SECRET);
console.log("CALLBACK:", process.env.GOOGLE_CALLBACK_URL);

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails[0].value;
        let user = await User.findOne({ email });

        if (!user) {
          // ✅ NEW USER: Create with profileCompleted false
          user = await User.create({
            email: email,
            password: "google-auth", // dummy password
            name: profile.displayName || email.split('@')[0],
            googleId: profile.id,
            profileCompleted: false, // ✅ IMPORTANT: New users need to complete profile
            role: 'user' // ✅ Default role
          });
          console.log('✅ New Google user created:', email);
        } else {
          console.log('✅ Existing Google user found:', email);
          console.log('📋 Profile completed:', user.profileCompleted);
        }

        return done(null, user);
      } catch (err) {
        console.error('Google Strategy Error:', err);
        return done(err, null);
      }
    }
  )
);

// Serialize/Deserialize
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

export default passport;
