
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
    // Identificador fijo para mantener un único inventario compartido.
    inventoryKey: {
      type: String,
      required: true,
      unique: true,
      default: "main",
    },

    // Ingredientes disponibles.
    ingredients: {
      type: [ingredientSchema],
      default: [],
    },

    // Recetas asociadas a los productos.
    // Se conserva la estructura actual del frontend:
    // { "productId": [{ ingredientId, quantity }] }
    recipes: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // Versión para controlar modificaciones concurrentes.
    revision: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Inventory", inventorySchema);
