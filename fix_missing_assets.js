import mongoose from "mongoose";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import Product from "./models/product.models.js";

dotenv.config();

const fixMissingAssets = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB for fix");

    const auditResults = JSON.parse(fs.readFileSync("audit_results.json", "utf-8"));
    const { missingDetails } = auditResults;

    if (!missingDetails || missingDetails.length === 0) {
      console.log("No missing assets to fix.");
      await mongoose.connection.close();
      return;
    }

    console.log(`Found ${missingDetails.length} missing image references. Fixing...`);

    let fixedCount = 0;
    for (const detail of missingDetails) {
      const product = await Product.findOne({ name: detail.productName });
      if (product) {
        const index = product.images.indexOf(detail.missingFile);
        if (index !== -1) {
          product.images[index] = "placeholder.jpg";
          product.markModified('images');
          await product.save();
          fixedCount++;
          console.log(`Fixed product: ${product.name} (replaced ${detail.missingFile} with placeholder.jpg)`);
        }
      }
    }

    console.log(`Fix complete. Updated ${fixedCount} image references.`);
    await mongoose.connection.close();
  } catch (error) {
    console.error("Fix failed:", error);
    process.exit(1);
  }
};

fixMissingAssets();
