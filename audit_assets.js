import mongoose from "mongoose";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import Product from "./models/product.models.js";

dotenv.config();

const auditAssets = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB for audit");

    const products = await Product.find({});
    const productsDir = path.join(process.cwd(), "products");
    
    if (!fs.existsSync(productsDir)) {
      console.error(`Products directory not found: ${productsDir}`);
      process.exit(1);
    }

    const filesOnDisk = fs.readdirSync(productsDir);
    console.log(`Found ${filesOnDisk.length} files in products folder.`);

    let missingTotal = 0;
    const missingDetails = [];

    for (const product of products) {
      if (product.images && product.images.length > 0) {
        for (const img of product.images) {
          if (!filesOnDisk.includes(img)) {
            missingTotal++;
            missingDetails.push({
              productName: product.name,
              missingFile: img
            });
          }
        }
      } else {
        console.log(`Product "${product.name}" has NO images.`);
      }
    }

    const results = {
      foundCount: filesOnDisk.length,
      missingTotal,
      missingDetails
    };

    fs.writeFileSync("audit_results.json", JSON.stringify(results, null, 2));
    console.log(`\nAudit Complete: Found ${missingTotal} missing image references. Results saved to audit_results.json`);

    await mongoose.connection.close();
  } catch (error) {
    console.error("Audit failed:", error);
    process.exit(1);
  }
};

auditAssets();
