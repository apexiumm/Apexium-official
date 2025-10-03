// lib/mongodb.ts
import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI as string; // <-- force TypeScript to treat it as string

if (!MONGODB_URI) {
  throw new Error("❌ Please define the MONGODB_URI environment variable in .env.local or Vercel");
}

/**
 * Global is used here to maintain a cached connection across hot reloads in development
 */
let cached = (global as any).mongoose;

if (!cached) {
  cached = (global as any).mongoose = { conn: null, promise: null };
}

export async function connectToDB() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    console.log("🔌 Attempting MongoDB connection...");
    console.log("👉 Using URI:", MONGODB_URI.replace(/\/\/.:.@/, "//<user>:<password>@")); 
    // Masks sensitive part but still shows cluster/db name

    cached.promise = mongoose.connect(MONGODB_URI, {
      dbName: "Apexium", // optional, Atlas also picks it from URI
    })
    .then((mongoose) => {
      console.log("✅ MongoDB connected successfully");
      return mongoose;
    })
    .catch((err) => {
      console.error("❌ MongoDB connection error:", err);
      throw err;
    });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}