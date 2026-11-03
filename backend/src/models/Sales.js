
const mongoose = require("mongoose");

// Productos incluidos en una venta
const saleItemSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
    },

    name: {
      type: String,
      required: true,
    },

    emoji: {
      type: String,
      default: "📦",
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
    },

    category: {
      type: String,
    },
  },
  {
    _id: false,
    strict: false,
  }
);

// Información del pago
const paymentDetailsSchema = new mongoose.Schema(
  {
    received: {
      type: Number,
      default: 0,
      min: 0,
    },

    change: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    _id: false,
  }
);

// Modelo principal de ventas
const saleSchema = new mongoose.Schema(
  {
    // Identificador original generado por el TPV
    clientSaleId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    saleNumber: {
      type: Number,
      required: true,
      min: 1,
    },

    // Fecha original de la operación
    date: {
      type: Date,
      required: true,
    },

    items: {
      type: [saleItemSchema],
      required: true,
      validate: {
        validator: (items) => items.length > 0,
        message: "Una venta debe contener al menos un producto.",
      },
    },

    total: {
      type: Number,
      required: true,
      min: 0,
    },

    paymentMethod: {
      type: String,
      required: true,
      enum: ["cash", "card"],
    },

    paymentDetails: {
      type: paymentDetailsSchema,
      default: () => ({}),
    },

    // Identificador del dispositivo que realizó la venta
    deviceId: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// El identificador de cada venta debe ser único.
// Esto permitirá evitar duplicados cuando se reintente
// una sincronización después de perder Internet.
saleSchema.index(
  { clientSaleId: 1 },
  { unique: true }
);

module.exports = mongoose.model("Sale", saleSchema);
