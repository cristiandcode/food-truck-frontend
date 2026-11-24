
const Sale = require("../models/Sale");
const Product = require("../models/Product");

// Redondear importes a céntimos
function toCents(value) {
  return Math.round(Number(value) * 100);
}

function fromCents(value) {
  return Number((value / 100).toFixed(2));
}

// Registrar una venta
const createSale = async (req, res) => {
  try {
    const saleData = req.body;

    const clientSaleId = saleData.clientSaleId || saleData.id;

    if (!clientSaleId) {
      return res.status(400).json({
        message: "La venta debe incluir un identificador único.",
      });
    }

    const existingSale = await Sale.findOne({ clientSaleId });

    if (existingSale) {
      return res.status(200).json({
        message: "La venta ya estaba registrada.",
        duplicated: true,
        sale: existingSale,
      });
    }

    if (
      !Array.isArray(saleData.items) ||
      saleData.items.length === 0
    ) {
      return res.status(400).json({
        message: "La venta debe contener al menos un producto.",
      });
    }

    const isSeniorCustomer =
      saleData.isSeniorCustomer === true;

    if (
      saleData.isSeniorCustomer !== undefined &&
      typeof saleData.isSeniorCustomer !== "boolean"
    ) {
      return res.status(400).json({
        message: "El indicador de cliente jubilado debe ser verdadero o falso.",
      });
    }

    for (const item of saleData.items) {
      const price = Number(item.price);
      const quantity = Number(item.quantity);

      if (
        !Number.isFinite(price) ||
        price < 0 ||
        !Number.isInteger(quantity) ||
        quantity < 1
      ) {
        return res.status(400).json({
          message: "Uno o más productos tienen un precio o cantidad no válidos.",
        });
      }
    }

    const clientProductIds = saleData.items
      .map((item) => item.clientProductId)
      .filter(Boolean)
      .map(String);

    const numericProductIds = saleData.items
      .map((item) => Number(item.id))
      .filter((id) => Number.isInteger(id) && id > 0);

    const databaseProducts = await Product.find({
      $or: [
        {
          clientProductId: {
            $in: clientProductIds,
          },
        },
        {
          id: {
            $in: numericProductIds,
          },
        },
      ],
    })
      .select("id clientProductId seniorDiscountEligible")
      .lean();

    const productsByClientId = new Map();
    const productsByNumericId = new Map();

    for (const product of databaseProducts) {
      if (product.clientProductId) {
        productsByClientId.set(
          String(product.clientProductId),
          product
        );
      }

      productsByNumericId.set(
        Number(product.id),
        product
      );
    }

    let subtotalCents = 0;
    let discountCents = 0;

    const calculatedItems = saleData.items.map((item) => {
      const clientProductId = item.clientProductId
        ? String(item.clientProductId)
        : null;

      const numericId = Number(item.id);

      const databaseProduct =
        (clientProductId
          ? productsByClientId.get(clientProductId)
          : null) ||
        (Number.isInteger(numericId)
          ? productsByNumericId.get(numericId)
          : null);

      const eligible =
        databaseProduct?.seniorDiscountEligible === true;

      const priceCents = toCents(item.price);
      const quantity = Number(item.quantity);

      const lineSubtotalCents = priceCents * quantity;

      const lineDiscountCents =
        isSeniorCustomer && eligible
          ? Math.round(lineSubtotalCents * 0.05)
          : 0;

      const lineTotalCents =
        lineSubtotalCents - lineDiscountCents;

      subtotalCents += lineSubtotalCents;
      discountCents += lineDiscountCents;

      return {
        ...item,
        id: String(item.id),
        clientProductId,
        seniorDiscountEligible: eligible,
        discountAmount: fromCents(lineDiscountCents),
        lineTotal: fromCents(lineTotalCents),
      };
    });

    const totalCents = subtotalCents - discountCents;

    const subtotal = fromCents(subtotalCents);
    const discountAmount = fromCents(discountCents);
    const total = fromCents(totalCents);

    if (!["cash", "card"].includes(saleData.paymentMethod)) {
      return res.status(400).json({
        message: "El método de pago no es válido.",
      });
    }

    const received = Number(
      saleData.paymentDetails?.received
    );

    let paymentDetails;

    if (saleData.paymentMethod === "cash") {
      if (
        !Number.isFinite(received) ||
        received < total
      ) {
        return res.status(400).json({
          message: "El importe recibido es insuficiente o no es válido.",
        });
      }

      paymentDetails = {
        received: fromCents(toCents(received)),
        change: fromCents(toCents(received) - totalCents),
      };
    } else {
      paymentDetails = {
        received: total,
        change: 0,
      };
    }

    const newSale = new Sale({
      ...saleData,
      clientSaleId,
      items: calculatedItems,
      subtotal,
      isSeniorCustomer,
      discountRate: isSeniorCustomer ? 5 : 0,
      discountAmount,
      total,
      paymentDetails,
    });

    const savedSale = await newSale.save();

    return res.status(201).json({
      message: "Venta registrada correctamente.",
      duplicated: false,
      sale: savedSale,
    });

  } catch (error) {
    if (error.code === 11000) {
      try {
        const clientSaleId =
          req.body.clientSaleId || req.body.id;

        const existingSale = await Sale.findOne({
          clientSaleId,
        });

        if (existingSale) {
          return res.status(200).json({
            message: "La venta ya estaba registrada.",
            duplicated: true,
            sale: existingSale,
          });
        }
      } catch (lookupError) {
        console.error(
          "Error buscando la venta duplicada:",
          lookupError.message
        );
      }
    }

    console.error(
      "Error registrando la venta:",
      error.message
    );

    if (
      error.name === "ValidationError" ||
      error.name === "CastError"
    ) {
      return res.status(400).json({
        message: "Los datos de la venta no son válidos.",
        error: error.message,
      });
    }

    return res.status(500).json({
      message: "Error interno al registrar la venta.",
    });
  }
};

// Consultar el historial de ventas
const getSales = async (req, res) => {
  try {
    const sales = await Sale.find().sort({
      date: -1,
      createdAt: -1,
    });

    return res.status(200).json({
      total: sales.length,
      sales,
    });
  } catch (error) {
    console.error(
      "Error consultando las ventas:",
      error.message
    );

    return res.status(500).json({
      message: "Error interno al consultar las ventas.",
    });
  }
};

// Eliminar todas las ventas del historial
const deleteAllSales = async (req, res) => {
  try {
    const result = await Sale.deleteMany({});

    return res.status(200).json({
      success: true,
      message: "El historial de ventas se ha eliminado correctamente.",
      deletedCount: result.deletedCount || 0,
    });
  } catch (error) {
    console.error(
      "Error eliminando el historial de ventas:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message: "No se pudo eliminar el historial de ventas.",
    });
  }
};

// Cancelar una venta (no se borra: se marca como cancelada)
const cancelSale = async (req, res) => {
  try {
    const { clientSaleId } = req.params;

    if (!clientSaleId) {
      return res.status(400).json({
        message: "Falta el identificador de la venta.",
      });
    }

    let cancelledAt = new Date();

    if (req.body && req.body.cancelledAt) {
      const parsedDate = new Date(req.body.cancelledAt);

      if (!Number.isNaN(parsedDate.getTime())) {
        cancelledAt = parsedDate;
      }
    }

    const updatedSale = await Sale.findOneAndUpdate(
      {
        clientSaleId,
        status: { $ne: "cancelled" },
      },
      {
        $set: {
          status: "cancelled",
          cancelledAt,
        },
      },
      { new: true }
    );

    if (updatedSale) {
      return res.status(200).json({
        message: "Venta cancelada correctamente.",
        alreadyCancelled: false,
        sale: updatedSale,
      });
    }

    const existingSale = await Sale.findOne({ clientSaleId });

    if (!existingSale) {
      return res.status(404).json({
        message: "La venta no existe en el servidor.",
      });
    }

    return res.status(200).json({
      message: "La venta ya estaba cancelada.",
      alreadyCancelled: true,
      sale: existingSale,
    });

  } catch (error) {
    console.error(
      "Error cancelando la venta:",
      error.message
    );

    return res.status(500).json({
      message: "Error interno al cancelar la venta.",
    });
  }
};

// Modificar el método de pago de una venta ya registrada.
const updateSalePaymentMethod = async (req, res) => {
  try {
    const { clientSaleId } = req.params;
    const { paymentMethod } = req.body || {};

    if (!clientSaleId) {
      return res.status(400).json({
        message: "Falta el identificador de la venta.",
      });
    }

    if (!["cash", "card"].includes(paymentMethod)) {
      return res.status(400).json({
        message: "El método de pago no es válido.",
      });
    }

    const existingSale = await Sale.findOne({ clientSaleId });

    if (!existingSale) {
      return res.status(404).json({
        message: "La venta no existe en el servidor.",
      });
    }

    if (existingSale.status === "cancelled") {
      return res.status(409).json({
        message: "No se puede modificar el pago de una venta cancelada.",
      });
    }

    let paymentDetails;
    const totalCents = toCents(existingSale.total);

    if (paymentMethod === "cash") {
      const received = Number(req.body?.received);
      const receivedCents = toCents(received);

      if (
        !Number.isFinite(received) ||
        !Number.isFinite(receivedCents) ||
        receivedCents < totalCents
      ) {
        return res.status(400).json({
          message: "El importe recibido debe ser igual o superior al total de la venta.",
        });
      }

      paymentDetails = {
        received: fromCents(receivedCents),
        change: fromCents(receivedCents - totalCents),
      };
    } else {
      paymentDetails = {
        received: 0,
        change: 0,
      };
    }

    const updatedSale = await Sale.findOneAndUpdate(
      {
        clientSaleId,
        status: { $ne: "cancelled" },
      },
      {
        $set: {
          paymentMethod,
          paymentDetails,
        },
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!updatedSale) {
      const latestSale = await Sale.findOne({ clientSaleId });

      if (!latestSale) {
        return res.status(404).json({
          message: "La venta no existe en el servidor.",
        });
      }

      return res.status(409).json({
        message: "No se puede modificar el pago de una venta cancelada.",
      });
    }

    return res.status(200).json({
      message: "Método de pago actualizado correctamente.",
      sale: updatedSale,
    });
  } catch (error) {
    console.error(
      "Error modificando el método de pago:",
      error.message
    );

    if (
      error.name === "ValidationError" ||
      error.name === "CastError"
    ) {
      return res.status(400).json({
        message: "Los datos del pago no son válidos.",
        error: error.message,
      });
    }

    return res.status(500).json({
      message: "Error interno al modificar el método de pago.",
    });
  }
};

module.exports = {
  createSale,
  getSales,
  deleteAllSales,
  cancelSale,
  updateSalePaymentMethod,
};
