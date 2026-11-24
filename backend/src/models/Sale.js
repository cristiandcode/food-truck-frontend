
const mongoose = require("mongoose");

// Productos incluidos en una venta
const saleItemSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
    },

    clientProductId: {
      type: String,
      default: null,
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

    seniorDiscountEligible: {
      type: Boolean,
      default: false,
    },

    discountAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    lineTotal: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    _id: false,
    strict: false,
  }
);

// Fotografía del consumo de ingredientes al realizar la venta
const inventoryConsumptionSchema = new mongoose.Schema(
  {
    ingredientId: {
      type: String,
      required: true,
    },

    name: {
      type: String,
      required: true,
    },

    unit: {
      type: String,
      default: "unidad",
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
  },
  {
    _id: false,
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
    clientSaleId: {
      type: String,
      required: true,
    },

    saleNumber: {
      type: Number,
      required: true,
      min: 1,
    },

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

    // Consumo de ingredientes calculado al confirmar la venta
    inventoryConsumption: {
      type: [inventoryConsumptionSchema],
      default: [],
    },

    subtotal: {
      type: Number,
      min: 0,
      default: 0,
    },

    isSeniorCustomer: {
      type: Boolean,
      default: false,
    },

    discountRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },

    discountAmount: {
      type: Number,
      default: 0,
      min: 0,
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

    status: {
      type: String,
      enum: ["completed", "cancelled"],
      default: "completed",
    },

    cancelledAt: {
      type: Date,
      default: null,
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

// Evita registrar dos veces la misma venta
saleSchema.index(
  { clientSaleId: 1 },
  { unique: true }
);

module.exports = mongoose.model("Sale", saleSchema);
