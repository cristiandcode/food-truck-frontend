
const express = require("express");

const {
  createSale,
  getSales,
  deleteAllSales,
  cancelSale,
  updateSalePaymentMethod,
} = require("../controllers/saleController");

const router = express.Router();

// Registrar una venta
router.post("/", createSale);

// Consultar todas las ventas
router.get("/", getSales);

// Eliminar todo el historial de ventas
router.delete("/all", deleteAllSales);

// Cancelar una venta
router.post("/:clientSaleId/cancel", cancelSale);

// Modificar el método de pago de una venta registrada
router.patch("/:clientSaleId/payment", updateSalePaymentMethod);

module.exports = router;
