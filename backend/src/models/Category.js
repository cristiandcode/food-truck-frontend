const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 40,
    },

    icon: {
      type: String,
      default: "📦",
    },

    order: {
      type: Number,
      default: 100,
    },

    // null = activa. Una fecha = eliminada.
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Category", categorySchema);