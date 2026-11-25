
const Inventory = require("../models/Inventory");

const INVENTORY_KEY = "main";

// Formato común de respuesta.
const formatInventory = (inventory) => ({
  ingredients: inventory.ingredients,
  recipes: inventory.recipes || {},
  revision: inventory.revision,
  initialized: inventory.initialized,
  updatedAt: inventory.updatedAt,
});

// Obtener el inventario compartido.
const getInventory = async (req, res) => {
  try {
    const inventory = await Inventory.findOneAndUpdate(
      { inventoryKey: INVENTORY_KEY },
      {
        $setOnInsert: {
          inventoryKey: INVENTORY_KEY,
          ingredients: [],
          recipes: {},
          revision: 0,
          initialized: false,
        },
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    );

    return res.json({
      success: true,
      inventory: formatInventory(inventory),
    });
  } catch (error) {
    console.error("Error obteniendo inventario:", error.message);

    return res.status(500).json({
      success: false,
      message: "No se pudo obtener el inventario.",
    });
  }
};

// Inicializar el inventario por primera vez.
const initializeInventory = async (req, res) => {
  try {
    const { ingredients, recipes } = req.body;

    if (
      !Array.isArray(ingredients) ||
      !recipes ||
      typeof recipes !== "object" ||
      Array.isArray(recipes)
    ) {
      return res.status(400).json({
        success: false,
        message: "Los datos iniciales del inventario no son válidos.",
      });
    }

    // Garantizamos que exista el documento.
    await Inventory.findOneAndUpdate(
      { inventoryKey: INVENTORY_KEY },
      {
        $setOnInsert: {
          inventoryKey: INVENTORY_KEY,
          ingredients: [],
          recipes: {},
          revision: 0,
          initialized: false,
        },
      },
      {
        upsert: true,
        setDefaultsOnInsert: true,
      }
    );

    // Solo un dispositivo puede realizar la inicialización.
    // Una vez inicializado, nunca vuelve a aceptar una migración.
    const inventory = await Inventory.findOneAndUpdate(
      {
        inventoryKey: INVENTORY_KEY,
        initialized: false,
      },
      {
        $set: {
          ingredients,
          recipes,
          initialized: true,
        },
        $inc: {
          revision: 1,
        },
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!inventory) {
      const currentInventory = await Inventory.findOne({
        inventoryKey: INVENTORY_KEY,
      });

      return res.status(409).json({
        success: false,
        initialized: false,
        message: "El inventario ya fue inicializado.",
        inventory: currentInventory
          ? formatInventory(currentInventory)
          : null,
      });
    }

    return res.status(201).json({
      success: true,
      initialized: true,
      inventory: formatInventory(inventory),
    });
  } catch (error) {
    console.error("Error inicializando inventario:", error.message);

    return res.status(500).json({
      success: false,
      message: "No se pudo inicializar el inventario.",
    });
  }
};

// Guardar cambios con control de versiones.
const updateInventory = async (req, res) => {
  try {
    const { ingredients, recipes, revision } = req.body;

    if (
      !Array.isArray(ingredients) ||
      !recipes ||
      typeof recipes !== "object" ||
      Array.isArray(recipes) ||
      !Number.isInteger(revision)
    ) {
      return res.status(400).json({
        success: false,
        message: "Los datos del inventario no son válidos.",
      });
    }

    const inventory = await Inventory.findOneAndUpdate(
      {
        inventoryKey: INVENTORY_KEY,
        initialized: true,
        revision,
      },
      {
        $set: {
          ingredients,
          recipes,
        },
        $inc: {
          revision: 1,
        },
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!inventory) {
      const currentInventory = await Inventory.findOne({
        inventoryKey: INVENTORY_KEY,
      });

      return res.status(409).json({
        success: false,
        conflict: true,
        message: "El inventario fue modificado desde otro dispositivo o todavía no fue inicializado.",
        inventory: currentInventory
          ? formatInventory(currentInventory)
          : null,
      });
    }

    return res.json({
      success: true,
      inventory: formatInventory(inventory),
    });
  } catch (error) {
    console.error("Error actualizando inventario:", error.message);

    return res.status(500).json({
      success: false,
      message: "No se pudo guardar el inventario.",
    });
  }
};

module.exports = {
  getInventory,
  initializeInventory,
  updateInventory,
};
