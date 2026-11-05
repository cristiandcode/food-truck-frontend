const Sale = require("../models/Sale");

// Registrar una venta
const createSale = async (req, res) => {
  try {
    const saleData = req.body;

    // Aceptamos el identificador original del TPV (id)
    // o el nombre utilizado por el backend (clientSaleId).
    const clientSaleId = saleData.clientSaleId || saleData.id;

    if (!clientSaleId) {
      return res.status(400).json({
        message: "La venta debe incluir un identificador único.",
      });
    }

    // Comprobar si la venta ya existe.
    // Esto permite reintentar una sincronización sin duplicarla.
    const existingSale = await Sale.findOne({ clientSaleId });

    if (existingSale) {
      return res.status(200).json({
        message: "La venta ya estaba registrada.",
        duplicated: true,
        sale: existingSale,
      });
    }

    // Preparar los datos para MongoDB.
    // Se conserva la fecha original de la venta.
    const newSale = new Sale({
      ...saleData,
      clientSaleId,
    });

    const savedSale = await newSale.save();

    return res.status(201).json({
      message: "Venta registrada correctamente.",
      duplicated: false,
      sale: savedSale,
    });
  } catch (error) {
    // Protección adicional ante dos peticiones simultáneas
    // con el mismo identificador.
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

    console.error("Error registrando la venta:", error.message);

    if (error.name === "ValidationError" || error.name === "CastError") {
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
    console.error("Error consultando las ventas:", error.message);

    return res.status(500).json({
      message: "Error interno al consultar las ventas.",
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

    // Conservar la fecha original de la cancelación si el TPV la envía
    // (por ejemplo, si se canceló sin conexión).
    let cancelledAt = new Date();

    if (req.body && req.body.cancelledAt) {
      const parsedDate = new Date(req.body.cancelledAt);

      if (!Number.isNaN(parsedDate.getTime())) {
        cancelledAt = parsedDate;
      }
    }

    // Operación atómica: solo cancela si todavía no está cancelada.
    // Las ventas antiguas sin "status" también coinciden con $ne.
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

    // No se actualizó nada: puede estar ya cancelada o no existir
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
    console.error("Error cancelando la venta:", error.message);

    return res.status(500).json({
      message: "Error interno al cancelar la venta.",
    });
  }
};

module.exports = {
  createSale,
  getSales,
  cancelSale,
};