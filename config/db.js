const mongoose = require("mongoose");

async function connectToDatabase(connectionString) {
  await mongoose.connect(connectionString);
  console.log("Connected to MongoDB.");
}

module.exports = connectToDatabase;
