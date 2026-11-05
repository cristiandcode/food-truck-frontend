
const express = require("express");

const {
  createProduct,
  getProducts,
  updateProduct,
  deactivateProduct,
  activateProduct,
} = require("../controllers/productController");

const router = express.Router();

// Crear un producto
router.post("/", createProduct);

// Consultar todos los productos
router.get("/", getProducts);

// Actualizar un producto
router.put("/:clientProductId", updateProduct);

// Desactivar un producto
router.patch("/:clientProductId/deactivate", deactivateProduct);

// Activar un producto
router.patch("/:clientProductId/activate", activateProduct);

module.exports = router;
