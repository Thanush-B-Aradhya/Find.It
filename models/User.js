const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 120
    },
    googleSub: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      maxlength: 120
    },
    displayName: {
      type: String,
      trim: true,
      maxlength: 80
    },
    avatarUrl: {
      type: String,
      trim: true,
      maxlength: 500
    },
    lastLoginAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("User", userSchema);
