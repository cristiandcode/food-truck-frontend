
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

    // Elegibilidad comprobada por el backend
    seniorDiscountEligible: {
      type: Boolean,
      default: false,
    },

    // Descuento aplicado a esta línea
    discountAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Importe final de esta línea
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
    },

    saleNumber: {
      type: Number,
      required: true,
      min: 1,
    },

    // Fecha y hora originales de la operación
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

    // Importe antes de aplicar descuentos
    subtotal: {
      type: Number,
      min: 0,
      default: 0,
    },

    // Indica si el cliente es jubilado o pensionado
    isSeniorCustomer: {
      type: Boolean,
      default: false,
    },

    // Porcentaje de descuento aplicado
    discountRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },

    // Importe total descontado
    discountAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Total final después de descuentos
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

    // Estado de la venta. Las ventas anteriores no lo tienen
    // y se consideran completadas.
    status: {
      type: String,
      enum: ["completed", "cancelled"],
      default: "completed",
    },

    // Fecha y hora de la cancelación
    cancelledAt: {
      type: Date,
      default: null,
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

// Evita registrar dos veces la misma venta
// cuando se reintenta una sincronización.
saleSchema.index(
  { clientSaleId: 1 },
  { unique: true }
);

module.exports = mongoose.model("Sale", saleSchema);
