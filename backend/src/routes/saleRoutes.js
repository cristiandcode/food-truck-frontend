const express = require("express");

const {
  createSale,
  getSales,
  cancelSale,
} = require("../controllers/saleController");

const router = express.Router();

// Registrar una venta
router.post("/", createSale);

// Consultar todas las ventas
router.get("/", getSales);

// Cancelar una venta
router.post("/:clientSaleId/cancel", cancelSale);

module.exports = router;