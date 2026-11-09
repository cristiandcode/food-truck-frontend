const express = require("express");

const {
  getCategories,
  createCategory,
  deleteCategory,
} = require("../controllers/categoryController");

const router = express.Router();

router.get("/", getCategories);
router.post("/", createCategory);
router.delete("/:categoryId", deleteCategory);

module.exports = router;