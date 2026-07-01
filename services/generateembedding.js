import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
  path: path.resolve(__dirname, "../.env")
});

import dns from "node:dns";

dns.setDefaultResultOrder("ipv4first");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

import mongoose from "mongoose";
import Product from "../models/product.models.js";
import { embedText } from "../services/text_to_vector.js";
import { connectDB } from "../config/connectDB.js";

const productId = process.argv[2];

if (!productId) {
  console.log("Usage: node scripts/generateEmbedding.js <productId>");
  process.exit(1);
}

const run = async () => {
  try {
    await connectDB();

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      throw new Error("Invalid product id");
    }

    const product = await Product.findById(productId);

    if (!product) {
      throw new Error("Product not found");
    }

    const text = `
      ${product.name}
      ${product.category}
      ${product.description}
      ${(product.tags || []).join(" ")}
    `.trim();

    console.log("Generating embedding for:", product.name);

    const embedding = await embedText(text);

    await Product.findByIdAndUpdate(productId, {
      embedding
    });

    console.log("Embedding saved successfully");
    process.exit(0);

  } catch (error) {
    console.error("ERROR:", error.message);
    process.exit(1);
  }
};

run();