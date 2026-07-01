import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: String, required: true },
  description: { type: String, required: true },
  offerPrice: { type: String, required: true },
  images: { type: Array, required: false },
  category: { type: String, required: true },
  isDealOfDay: { type: Boolean, default: false },
  inStock: { type: Boolean, default: true },
  stock: { type: Number, default: 0 },
  stockThreshold: { type: Number, default: 10 },
  tags: { type: [String], default: [] },
   embedding: {
    type: [Number],
    default: []
  }
}, { timestamps: true });

const Product = mongoose.model("Product", productSchema);
export default Product;
