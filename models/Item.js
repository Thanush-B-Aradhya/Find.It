const mongoose = require("mongoose");

const CATEGORY_OPTIONS = [
  "electronics",
  "pets",
  "accessories",
  "documents",
  "clothing",
  "keys",
  "bags",
  "other"
];

const itemSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["lost", "found"],
      required: [true, "Type is required."]
    },
    status: {
      type: String,
      enum: ["open", "resolved"],
      default: "open"
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true
    },
    ownerEmail: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 120
    },
    ownerTokenHash: {
      type: String,
      trim: true,
      maxlength: 64,
      index: true
    },
    photoData: {
      type: String,
      required: [true, "Photo is required."]
    },
    name: {
      type: String,
      required: [true, "Item name is required."],
      trim: true,
      maxlength: 60
    },
    category: {
      type: String,
      enum: CATEGORY_OPTIONS,
      default: "other"
    },
    description: {
      type: String,
      required: [true, "Description is required."],
      trim: true,
      maxlength: 1000
    },
    location: {
      type: String,
      trim: true,
      maxlength: 120
    },
    date: {
      type: Date,
      default: null
    },
    contactName: {
      type: String,
      trim: true,
      maxlength: 80
    },
    phone: {
      type: String,
      trim: true,
      maxlength: 40
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 120
    },
    reward: {
      type: String,
      trim: true,
      maxlength: 160
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Item", itemSchema);
