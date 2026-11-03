
const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    console.log("MongoDB Atlas conectado correctamente");
  } catch (error) {
    console.error("Error conectando a MongoDB:", error.message);
    throw error;
  }
};

module.exports = connectDB;
