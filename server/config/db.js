import mongoose from "mongoose";
import { config } from "./config.js";

export async function connectDB() {
  try {
    await mongoose.connect(config.mongoURI);
    console.log("Database connected")
  } catch (error) {
    console.log(error.message);
    console.log("Could not connect to the database")
    process.exit(1);
  }
}
process.on("SIGINT", async ()=> {
    await mongoose.disconnect();
    console.log("Client disconnected")
    process.exit(0);
})

