
require("dotenv").config();

const express = require("express");
const cors = require("cors");

const connectDB = require("./src/config/db");
const saleRoutes = require("./src/routes/saleRoutes");
const productRoutes = require("./src/routes/productRoutes");

const app = express();

// Configuración general
app.use(cors());
app.use(express.json());

// Ruta principal
app.get("/", (req, res) => {
  res.json({
    message: "Lubinin API funcionando correctamente",
    status: "OK",
  });
});

// Rutas de ventas
app.use("/api/sales", saleRoutes);

// Rutas de productos
app.use("/api/products", productRoutes);

// Puerto del servidor
const PORT = process.env.PORT || 5000;

// Iniciar servidor y conectar MongoDB
const startServer = async () => {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.log(`Servidor Lubinin funcionando en puerto ${PORT}`);
    });
  } catch (error) {
    console.error("Error al iniciar el servidor:", error.message);
    process.exit(1);
  }
};

startServer();
