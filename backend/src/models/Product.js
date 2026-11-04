
const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    // Identificador estable generado por el TPV.
    // Permite reconocer el mismo producto entre dispositivos.
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

    // Los productos se desactivan, no se eliminan.
    active: {
      type: Boolean,
      default: true,
    },

    // Identificador opcional del dispositivo que creó el producto.
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
