
const express = require("express");

const {
  getInventory,
  initializeInventory,
  updateInventory,
} = require("../controllers/inventoryController");

const router = express.Router();

// Obtener el inventario compartido.
router.get("/", getInventory);

// Migrar los ingredientes y recetas locales por primera vez.
router.post("/initialize", initializeInventory);

// Guardar modificaciones con control de versiones.
router.put("/", updateInventory);

module.exports = router;
