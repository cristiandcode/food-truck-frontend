
const express = require("express");

const {
  createSale,
  getSales,
} = require("../controllers/saleController");

const router = express.Router();

// Registrar una venta
router.post("/", createSale);

// Consultar todas las ventas
router.get("/", getSales);

module.exports = router;
