const Category = require("../models/Category");
const Product = require("../models/Product");

const defaultCategories = [
  { id: "burgers", name: "Hamburguesas", icon: "🍔", order: 1 },
  { id: "drinks", name: "Bebidas", icon: "🥤", order: 2 },
  { id: "coffee", name: "Cafetería", icon: "☕", order: 3 },
  { id: "bakery", name: "Bollería", icon: "🥐", order: 4 },
  { id: "combos", name: "Combos", icon: "🍟", order: 5 },
  { id: "extras", name: "Extras", icon: "🧀", order: 6 },
];

// Consultar categorías activas
const getCategories = async (req, res) => {
  try {
    for (const category of defaultCategories) {
      await Category.updateOne(
        { id: category.id },
        {
          $setOnInsert: {
            ...category,
            deletedAt: null,
          },
        },
        { upsert: true }
      );
    }

    const categories = await Category.find({
      deletedAt: null,
    }).sort({
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

    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const existingCategory = await Category.findOne({
      $or: [
        { id },
        {
          name: {
            $regex: `^${escapedName}$`,
            $options: "i",
          },
        },
      ],
    });

    if (existingCategory) {
      return res.status(409).json({
        message: existingCategory.deletedAt
          ? "Ya existe una categoría eliminada con ese identificador. Elegí otro nombre."
          : "Ya existe una categoría con ese nombre.",
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
      deletedAt: null,
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

// Eliminar una categoría y todos sus productos
const deleteCategory = async (req, res) => {
  try {
    const id = String(req.params.categoryId || "")
      .trim()
      .toLowerCase();

    if (!id || id === "all") {
      return res.status(400).json({
        message: "La categoría indicada no es válida.",
      });
    }

    const category = await Category.findOne({
      id,
      deletedAt: null,
    });

    if (!category) {
      return res.status(404).json({
        message: "La categoría no existe o ya fue eliminada.",
      });
    }

    // Eliminar definitivamente todos los productos de esta categoría.
    const deletionResult = await Product.deleteMany({
      category: id,
    });

    // Marcar la categoría como eliminada para que no vuelva a aparecer.
    category.deletedAt = new Date();
    await category.save();

    return res.status(200).json({
      message: "Categoría y productos eliminados correctamente.",
      categoryId: id,
      deletedProducts: deletionResult.deletedCount,
    });
  } catch (error) {
    console.error("Error eliminando categoría:", error.message);

    return res.status(500).json({
      message: "Error interno al eliminar la categoría.",
    });
  }
};

module.exports = {
  getCategories,
  createCategory,
  deleteCategory,
};