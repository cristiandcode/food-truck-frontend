
const Product = require("../models/Product");

// Crear un producto
const createProduct = async (req, res) => {
  try {
    const {
      id,
      clientProductId,
      name,
      price,
      category,
      emoji,
      active,
      seniorDiscountEligible,
      deviceId,
    } = req.body;

    // Validar campos obligatorios
    if (
      id === undefined ||
      !clientProductId ||
      !name ||
      !category ||
      price === undefined
    ) {
      return res.status(400).json({
        message: "Faltan datos obligatorios del producto.",
      });
    }

    // Comprobar que el ID numérico sea válido
    if (!Number.isInteger(Number(id)) || Number(id) < 1) {
      return res.status(400).json({
        message: "El ID del producto debe ser un número entero positivo.",
      });
    }

    // Validar elegibilidad para descuento
    if (
      seniorDiscountEligible !== undefined &&
      typeof seniorDiscountEligible !== "boolean"
    ) {
      return res.status(400).json({
        message: "La elegibilidad para el descuento debe ser verdadera o falsa.",
      });
    }

    // Comprobar duplicados por ambos identificadores
    const existingProduct = await Product.findOne({
      $or: [
        { id: Number(id) },
        { clientProductId },
      ],
    });

    if (existingProduct) {
      // Si ambos identificadores corresponden al mismo producto,
      // devolvemos el existente sin duplicarlo.
      if (
        existingProduct.id === Number(id) &&
        existingProduct.clientProductId === clientProductId
      ) {
        return res.status(200).json({
          message: "El producto ya estaba registrado.",
          duplicated: true,
          product: existingProduct,
        });
      }

      return res.status(409).json({
        message: "El ID numérico o el identificador del producto ya existe.",
      });
    }

    const newProduct = new Product({
      id: Number(id),
      clientProductId,
      name,
      price,
      category,
      emoji,
      active: active !== undefined ? active : true,
      seniorDiscountEligible:
        seniorDiscountEligible !== undefined
          ? seniorDiscountEligible
          : false,
      deviceId: deviceId || null,
    });

    const savedProduct = await newProduct.save();

    return res.status(201).json({
      message: "Producto creado correctamente.",
      duplicated: false,
      product: savedProduct,
    });

  } catch (error) {
    console.error("Error creando el producto:", error.message);

    if (error.code === 11000) {
      return res.status(409).json({
        message: "Ya existe un producto con ese identificador.",
      });
    }

    if (
      error.name === "ValidationError" ||
      error.name === "CastError"
    ) {
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
      id: 1,
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
      "seniorDiscountEligible",
    ];

    const updates = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    // Validar elegibilidad para descuento
    if (
      updates.seniorDiscountEligible !== undefined &&
      typeof updates.seniorDiscountEligible !== "boolean"
    ) {
      return res.status(400).json({
        message: "La elegibilidad para el descuento debe ser verdadera o falsa.",
      });
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        message: "No se recibieron cambios para actualizar.",
      });
    }

    const updatedProduct = await Product.findOneAndUpdate(
      {
        clientProductId: req.params.clientProductId,
      },
      {
        $set: updates,
      },
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

    if (
      error.name === "ValidationError" ||
      error.name === "CastError"
    ) {
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

// Cambiar el estado de un producto
const deactivateProduct = async (req, res) => {
  try {
    const product = await Product.findOneAndUpdate(
      {
        clientProductId: req.params.clientProductId,
      },
      {
        $set: {
          active: false,
        },
      },
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

// Activar un producto
const activateProduct = async (req, res) => {
  try {
    const product = await Product.findOneAndUpdate(
      {
        clientProductId: req.params.clientProductId,
      },
      {
        $set: {
          active: true,
        },
      },
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
      message: "Producto activado correctamente.",
      product,
    });

  } catch (error) {
    console.error("Error activando el producto:", error.message);

    return res.status(500).json({
      message: "Error interno al activar el producto.",
    });
  }
};

module.exports = {
  createProduct,
  getProducts,
  updateProduct,
  deactivateProduct,
  activateProduct,
};
