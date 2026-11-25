
const mongoose = require("mongoose");

// Estructura de cada ingrediente del almacén.
const ingredientSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    unit: {
      type: String,
      default: "unidad",
    },
  },
  {
    _id: false,
  }
);

// Documento único con el inventario compartido de Lubinin.
const inventorySchema = new mongoose.Schema(
  {
    inventoryKey: {
      type: String,
      required: true,
      unique: true,
      default: "main",
    },

    ingredients: {
      type: [ingredientSchema],
      default: [],
    },

    recipes: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    revision: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Distingue un inventario nunca migrado de uno
    // que fue inicializado y después quedó vacío.
    initialized: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Inventory", inventorySchema);
