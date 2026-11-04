
const express = require("express");

const {
  createProduct,
  getProducts,
  updateProduct,
  deactivateProduct,
} = require("../controllers/productController");

const router = express.Router();

// Crear un producto
router.post("/", createProduct);

// Consultar todos los productos
router.get("/", getProducts);

// Actualizar un producto
router.put("/:clientProductId", updateProduct);

// Desactivar un producto sin eliminarlo
router.patch("/:clientProductId/deactivate", deactivateProduct);

module.exports = router;
