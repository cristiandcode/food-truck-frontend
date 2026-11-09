
const Category = require("../models/Category");

const defaultCategories = [
  { id: "burgers", name: "Hamburguesas", icon: "🍔", order: 1 },
  { id: "drinks", name: "Bebidas", icon: "🥤", order: 2 },
  { id: "coffee", name: "Cafetería", icon: "☕", order: 3 },
  { id: "bakery", name: "Bollería", icon: "🥐", order: 4 },
  { id: "combos", name: "Combos", icon: "🍟", order: 5 },
  { id: "extras", name: "Extras", icon: "🧀", order: 6 },
];

// Consultar categorías
const getCategories = async (req, res) => {
  try {
    // Asegurar que las categorías originales existan en MongoDB.
    for (const category of defaultCategories) {
      await Category.updateOne(
        { id: category.id },
        { $setOnInsert: category },
        { upsert: true }
      );
    }

    const categories = await Category.find().sort({
      order: 1,
      name: 1,
    });

    return res.status(200).json({
      total: categories.length,
      categories,
    });
  } catch (error) {
    console.error("Error consultando categorías:", error.message);

    return res.status(500).json({
      message: "Error interno al consultar las categorías.",
    });
  }
};

// Crear una categoría
const createCategory = async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const icon = String(req.body.icon || "📦").trim();

    if (!name) {
      return res.status(400).json({
        message: "Ingresá el nombre de la categoría.",
      });
    }

    if (name.length > 40) {
      return res.status(400).json({
        message: "El nombre no puede superar los 40 caracteres.",
      });
    }

    // Generar un identificador estable a partir del nombre.
    const id = name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    if (!id) {
      return res.status(400).json({
        message: "El nombre de la categoría no es válido.",
      });
    }

    const existingCategory = await Category.findOne({
      $or: [
        { id },
        { name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } },
      ],
    });

    if (existingCategory) {
      return res.status(409).json({
        message: "Ya existe una categoría con ese nombre.",
        category: existingCategory,
      });
    }

    const lastCategory = await Category.findOne().sort({
      order: -1,
    });

    const category = new Category({
      id,
      name,
      icon: icon || "📦",
      order: (lastCategory?.order || 0) + 1,
    });

    const savedCategory = await category.save();

    return res.status(201).json({
      message: "Categoría creada correctamente.",
      category: savedCategory,
    });
  } catch (error) {
    console.error("Error creando categoría:", error.message);

    if (error.code === 11000) {
      return res.status(409).json({
        message: "Ya existe una categoría con ese identificador.",
      });
    }

    return res.status(500).json({
      message: "Error interno al crear la categoría.",
    });
  }
};

module.exports = {
  getCategories,
  createCategory,
};
