
const Product = require("../models/Product");

// Crear un producto
const createProduct = async (req, res) => {
  try {
    const {
      clientProductId,
      name,
      price,
      category,
      emoji,
      active,
      deviceId,
    } = req.body;

    if (!clientProductId || !name || !category || price === undefined) {
      return res.status(400).json({
        message: "Faltan datos obligatorios del producto.",
      });
    }

    // Evitar productos duplicados
    const existingProduct = await Product.findOne({
      clientProductId,
    });

    if (existingProduct) {
      return res.status(200).json({
        message: "El producto ya estaba registrado.",
        duplicated: true,
        product: existingProduct,
      });
    }

    const newProduct = new Product({
      clientProductId,
      name,
      price,
      category,
      emoji,
      active,
      deviceId,
    });

    const savedProduct = await newProduct.save();

    return res.status(201).json({
      message: "Producto creado correctamente.",
      duplicated: false,
      product: savedProduct,
    });
  } catch (error) {
    if (error.code === 11000) {
      const existingProduct = await Product.findOne({
        clientProductId: req.body.clientProductId,
      });

      if (existingProduct) {
        return res.status(200).json({
          message: "El producto ya estaba registrado.",
          duplicated: true,
          product: existingProduct,
        });
      }
    }

    console.error("Error creando el producto:", error.message);

    if (error.name === "ValidationError" || error.name === "CastError") {
      return res.status(400).json({
        message: "Los datos del producto no son válidos.",
        error: error.message,
      });
    }

    return res.status(500).json({
      message: "Error interno al crear el producto.",
    });
  }
};

// Consultar todos los productos
const getProducts = async (req, res) => {
  try {
    const products = await Product.find().sort({
      createdAt: 1,
    });

    return res.status(200).json({
      total: products.length,
      products,
    });
  } catch (error) {
    console.error("Error consultando los productos:", error.message);

    return res.status(500).json({
      message: "Error interno al consultar los productos.",
    });
  }
};

// Modificar un producto
const updateProduct = async (req, res) => {
  try {
    const allowedFields = [
      "name",
      "price",
      "category",
      "emoji",
      "active",
    ];

    const updates = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        message: "No se recibieron cambios para actualizar.",
      });
    }

    const updatedProduct = await Product.findOneAndUpdate(
      { clientProductId: req.params.clientProductId },
      { $set: updates },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!updatedProduct) {
      return res.status(404).json({
        message: "No se encontró el producto.",
      });
    }

    return res.status(200).json({
      message: "Producto actualizado correctamente.",
      product: updatedProduct,
    });
  } catch (error) {
    console.error("Error actualizando el producto:", error.message);

    if (error.name === "ValidationError" || error.name === "CastError") {
      return res.status(400).json({
        message: "Los datos del producto no son válidos.",
        error: error.message,
      });
    }

    return res.status(500).json({
      message: "Error interno al actualizar el producto.",
    });
  }
};

// Desactivar un producto sin eliminarlo
const deactivateProduct = async (req, res) => {
  try {
    const product = await Product.findOneAndUpdate(
      { clientProductId: req.params.clientProductId },
      { $set: { active: false } },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!product) {
      return res.status(404).json({
        message: "No se encontró el producto.",
      });
    }

    return res.status(200).json({
      message: "Producto desactivado correctamente.",
      product,
    });
  } catch (error) {
    console.error("Error desactivando el producto:", error.message);

    return res.status(500).json({
      message: "Error interno al desactivar el producto.",
    });
  }
};

module.exports = {
  createProduct,
  getProducts,
  updateProduct,
  deactivateProduct,
};
