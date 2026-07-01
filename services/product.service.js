import Product from "../models/product.models.js";
import { v2 as cloudinary } from "cloudinary";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";

class ProductService {
  async getAllProducts() {
    return await Product.find({});
  }

  async getProductById(id) {
    return await Product.findById(id);
  }

  async createProduct(productData) {
    const product = new Product(productData);
    const saved = await product.save();
    this.refreshRecommendations();
    return saved;
  }

  async updateProduct(id, updateData) {
    const product = await Product.findById(id);
    if (!product) throw new Error("Product not found");

    Object.keys(updateData).forEach((key) => {
      if (updateData[key] !== undefined) {
        product[key] = updateData[key];
      }
    });

    const updated = await product.save();
    this.refreshRecommendations();
    return updated;
  }

  async deleteProduct(id) {
    const product = await Product.findById(id);
    if (product) {
      await this.deleteFiles(product.images);
      await Product.findByIdAndDelete(id);
      this.refreshRecommendations();
      return product;
    }
    return null;
  }

  async toggleStock(id, inStock) {
    return await Product.findByIdAndUpdate(id, { inStock }, { new: true });
  }

  async searchProducts(query) {
    if (!query) return [];
    const products = await this.getAllProducts();
    
    const Fuse = (await import("fuse.js")).default;
    const fuse = new Fuse(products, {
      keys: ["name", "category"],
      threshold: 0.4, // Adjust for fuzziness (0 is exact, 1 is anything)
      includeScore: true
    });

    const results = fuse.search(query);
    return results.map(result => result.item);
  }

  async deleteFiles(imageUrls) {
    if (!imageUrls || !Array.isArray(imageUrls)) return;

    for (const url of imageUrls) {
      try {
        // Extract Cloudinary public_id from the URL
        // URL format: https://res.cloudinary.com/<cloud>/image/upload/v<version>/<public_id>.<ext>
        const match = url.match(/\/upload\/(?:v\d+\/)?(.+)\.[a-z]+$/i);
        if (match && match[1]) {
          await cloudinary.uploader.destroy(match[1]);
          console.log(`Deleted from Cloudinary: ${match[1]}`);
        }
      } catch (err) {
        console.error(`Error deleting image from Cloudinary: ${url}`, err);
      }
    }
  }

  refreshRecommendations() {
    const exportScript = path.join(process.cwd(), "export_products.js");
    const tfidfScript = path.join(process.cwd(), "recommendation", "tfidf_engine.py");

    console.log("Refreshing recommendations...");
    const exporter = spawn("node", [exportScript]);

    exporter.on("close", (code) => {
      if (code === 0) {
        const engine = spawn("python", [tfidfScript]);
        engine.on("close", (engineCode) => {
          if (engineCode === 0) {
            console.log("Similarity matrix updated successfully.");
          }
        });
      }
    });
  }
}

export default new ProductService();
