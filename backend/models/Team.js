const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    logo: { type: String, default: '' }, // Cloudinary URL
    tagline: { type: String, default: '' }, // e.g. "ONE CLAN. ONE FILE."
    region: { type: String, default: 'APAC' },
    theme: {
      // lets the admin tint each team's roster/card page differently
      primaryColor: { type: String, default: '#e6432b' },
      accentColor: { type: String, default: '#b8935a' },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Team', teamSchema);