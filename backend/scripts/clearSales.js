const path = require("path");

// Carga el .env del backend (el mismo que usa server.js)
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const mongoose = require("mongoose");
const Sale = require("../src/models/Sale");

const uri = process.env.MONGODB_URI || process.env.MONGO_URI;

if (!uri) {
  console.error(
    "No encuentro la URL de MongoDB en backend/.env (MONGODB_URI o MONGO_URI)."
  );
  process.exit(1);
}

const confirmed = process.argv.includes("--confirm");

async function run() {
  await mongoose.connect(uri);

  const total = await Sale.countDocuments();
  console.log(`Ventas en la base de datos: ${total}`);

  if (!confirmed) {
    console.log("Modo simulación: no se ha borrado nada.");
    console.log("Para borrar de verdad: node scripts/clearSales.js --confirm");
    return;
  }

  // Solo la colección sales. Los productos no se tocan.
  const result = await Sale.deleteMany({});
  console.log(`Ventas borradas: ${result.deletedCount}`);
}

run()
  .catch((error) => {
    console.error("Error:", error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());