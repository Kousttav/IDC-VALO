const mongoose = require('mongoose');

const ROLES = ['Duelist', 'Sentinel', 'Controller', 'Initiator', 'Flex', 'IGL'];
const RANKS = ['Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Ascendant', 'Immortal', 'Radiant'];

const playerSchema = new mongoose.Schema(
  {
    // Identity — captured from the tryout / sign-up form
    email: { type: String, required: true, trim: true, lowercase: true },
    fullName: { type: String, required: true, trim: true },
    discordUsername: { type: String, required: true, trim: true },
    contactNumber: { type: String, required: true, trim: true },
    dob: { type: Date, required: true }, // age is always derived from this, never stored
    languages: { type: String, trim: true, default: '' }, // free text, e.g. "English, Hindi, Tamil"

    // In-game identity
    ignTag: { type: String, required: true, trim: true }, // e.g. "Vanguard#IDC1"
    preferredServer: { type: String, required: true, trim: true },
    mainRole: { type: String, enum: ROLES, default: 'Flex' },
    secondaryRole: { type: String, enum: [...ROLES, ''], default: '' },
    currentRank: { type: String, enum: RANKS, required: true },
    peakRank: { type: String, enum: [...RANKS, ''], default: '' },
    trackerLink: { type: String, trim: true, default: '' },

    team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
    pic: { type: String, default: '' }, // Cloudinary URL — the player's card/profile photo

    // When the player originally filed in (sign-up form submission time / bulk import row),
    // distinct from createdAt which only tracks when the DB record itself was made.
    timestamp: { type: Date, default: Date.now },

    // Access control: whether this player also gets an admin-panel login.
    // 'none'  -> no login at all
    // 'staff' -> can log in, read-only / limited
    // 'admin' -> full admin panel access
    accessLevel: { type: String, enum: ['none', 'staff', 'admin'], default: 'none' },
    username: { type: String, trim: true, sparse: true, unique: true },
    passwordHash: { type: String, select: false },

    status: { type: String, enum: ['active', 'benched', 'inactive'], default: 'active' },
  },
  { timestamps: true }
);

playerSchema.virtual('age').get(function () {
  if (!this.dob) return null;
  const today = new Date();
  let age = today.getFullYear() - this.dob.getFullYear();
  const m = today.getMonth() - this.dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < this.dob.getDate())) age--;
  return age;
});

playerSchema.set('toJSON', { virtuals: true });
playerSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Player', playerSchema);
module.exports.ROLES = ROLES;
module.exports.RANKS = RANKS;