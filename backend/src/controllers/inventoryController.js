
const Inventory = require("../models/Inventory");

const INVENTORY_KEY = "main";

// Obtener el inventario compartido.
const getInventory = async (req, res) => {
  try {
    let inventory = await Inventory.findOne({
      inventoryKey: INVENTORY_KEY,
    });

    // Si todavía no existe, creamos un inventario vacío.
    if (!inventory) {
      inventory = await Inventory.create({
        inventoryKey: INVENTORY_KEY,
        ingredients: [],
        recipes: {},
        revision: 0,
      });
    }

    return res.json({
      success: true,
      inventory: {
        ingredients: inventory.ingredients,
        recipes: inventory.recipes || {},
        revision: inventory.revision,
        updatedAt: inventory.updatedAt,
      },
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
// Solo permite guardar datos si el inventario todavía está vacío.
const initializeInventory = async (req, res) => {
  try {
    const { ingredients, recipes } = req.body;

    if (!Array.isArray(ingredients) || !recipes || typeof recipes !== "object" || Array.isArray(recipes)) {
      return res.status(400).json({
        success: false,
        message: "Los datos iniciales del inventario no son válidos.",
      });
    }

    let inventory = await Inventory.findOne({
      inventoryKey: INVENTORY_KEY,
    });

    if (!inventory) {
      try {
        inventory = await Inventory.create({
          inventoryKey: INVENTORY_KEY,
          ingredients,
          recipes,
          revision: 1,
        });

        return res.status(201).json({
          success: true,
          initialized: true,
          inventory: {
            ingredients: inventory.ingredients,
            recipes: inventory.recipes || {},
            revision: inventory.revision,
            updatedAt: inventory.updatedAt,
          },
        });
      } catch (error) {
        // Puede ocurrir si dos dispositivos intentan inicializar
        // el inventario al mismo tiempo.
        if (error.code !== 11000) {
          throw error;
        }

        inventory = await Inventory.findOne({
          inventoryKey: INVENTORY_KEY,
        });
      }
    }

    const hasServerData =
      inventory.ingredients.length > 0 ||
      Object.keys(inventory.recipes || {}).length > 0;

    if (hasServerData) {
      return res.status(409).json({
        success: false,
        initialized: false,
        message: "El inventario ya contiene datos.",
        inventory: {
          ingredients: inventory.ingredients,
          recipes: inventory.recipes || {},
          revision: inventory.revision,
          updatedAt: inventory.updatedAt,
        },
      });
    }

    // Si el servidor está vacío, permitimos la migración inicial.
    inventory.ingredients = ingredients;
    inventory.recipes = recipes;
    inventory.revision += 1;

    await inventory.save();

    return res.json({
      success: true,
      initialized: true,
      inventory: {
        ingredients: inventory.ingredients,
        recipes: inventory.recipes || {},
        revision: inventory.revision,
        updatedAt: inventory.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error inicializando inventario:", error.message);

    return res.status(500).json({
      success: false,
      message: "No se pudo inicializar el inventario.",
    });
  }
};

// Guardar cambios del inventario con control de versiones.
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
        message: "El inventario fue modificado desde otro dispositivo.",
        inventory: currentInventory
          ? {
              ingredients: currentInventory.ingredients,
              recipes: currentInventory.recipes || {},
              revision: currentInventory.revision,
              updatedAt: currentInventory.updatedAt,
            }
          : null,
      });
    }

    return res.json({
      success: true,
      inventory: {
        ingredients: inventory.ingredients,
        recipes: inventory.recipes || {},
        revision: inventory.revision,
        updatedAt: inventory.updatedAt,
      },
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
