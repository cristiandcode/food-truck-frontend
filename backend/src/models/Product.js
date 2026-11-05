
const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    // ID numérico compatible con el TPV y las ventas.
    id: {
      type: Number,
      required: true,
      unique: true,
      min: 1,
    },

    // Identificador estable compartido entre dispositivos.
    clientProductId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    category: {
      type: String,
      required: true,
      trim: true,
    },

    emoji: {
      type: String,
      default: "📦",
    },

    active: {
      type: Boolean,
      default: true,
    },

    deviceId: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Product", productSchema);
