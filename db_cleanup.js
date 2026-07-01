import mongoose from "mongoose";
import dotenv from "dotenv";
import Product from "./models/product.models.js";

dotenv.config();

const cleanupDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB for cleanup");

    const products = await Product.find({});
    let updatedCount = 0;

    for (const product of products) {
      if (product.images && product.images.length > 0) {
        const originalImages = [...product.images];
        const sanitizedImages = product.images.map((img) => {
          if (typeof img !== 'string') return img;
          // Extract filename from URL or path
          // Example: http://localhost:5000/uploads/123.png -> 123.png
          // Example: /uploads/123.png -> 123.png
          const parts = img.split('/');
          return parts[parts.length - 1];
        });

        // Check if any change was made
        const hasChange = JSON.stringify(originalImages) !== JSON.stringify(sanitizedImages);

        if (hasChange) {
          product.images = sanitizedImages;
          await product.save();
          updatedCount++;
          console.log(`Updated product: ${product.name}`);
        }
      }
    }

    console.log(`Cleanup complete. Updated ${updatedCount} products.`);
    await mongoose.connection.close();
  } catch (error) {
    console.error("Cleanup failed:", error);
    process.exit(1);
  }
};

cleanupDatabase();
