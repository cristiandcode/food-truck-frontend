
require("dotenv").config();

const express = require("express");
const cors = require("cors");

const connectDB = require("./src/config/db");

const saleRoutes = require("./src/routes/saleRoutes");
const productRoutes = require("./src/routes/productRoutes");
const authRoutes = require("./src/routes/authRoutes");

const { requireAuth } = require("./src/middleware/auth");

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

// Ruta pública para ingresar con PIN
app.use("/api/auth", authRoutes);

// Rutas protegidas
app.use("/api/sales", requireAuth, saleRoutes);
app.use("/api/products", requireAuth, productRoutes);

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
    console.error("Error al iniciar servidor:", error.message);
    process.exit(1);
  }
};

startServer();
