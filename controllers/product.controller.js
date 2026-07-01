import productService from "../services/product.service.js";
import { v2 as cloudinary } from "cloudinary";
import { embedText } from "../services/text_to_vector.js";

// Upload image to cloudinary
const uploadToCloudinary = (file) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "maa-janki-bakery/products" },
      (error, result) => {
        if (error) return reject(error);
        resolve(result.secure_url);
      }
    );
    stream.end(file.buffer);
  });
};

// ADD PRODUCT
export const addProduct = async (req, res) => {
  try {
    const {
      name,
      price,
      offerPrice,
      description,
      category,
      isDealOfDay,
      tags,
      stock,
      stockThreshold,
    } = req.body;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Images required",
      });
    }

    const images = await Promise.all(req.files.map(uploadToCloudinary));

    const dealFlag = String(isDealOfDay).toLowerCase() === "true";

    const tagList = Array.isArray(tags)
      ? tags
      : tags
      ? tags.split(",").map((t) => t.trim())
      : [];

    // Generate embedding
    const productText = `
      ${name}
      ${category}
      ${description}
      ${tagList.join(" ")}
    `.trim();

    const embedding = await embedText(productText);

    const product = await productService.createProduct({
      name,
      price,
      offerPrice,
      description,
      category,
      isDealOfDay: dealFlag,
      images,
      tags: tagList,
      stock: stock ? Number(stock) : 0,
      stockThreshold: stockThreshold ? Number(stockThreshold) : 10,
      embedding,
    });

    res.status(201).json({
      success: true,
      product,
      message: "Product added successfully",
    });
  } catch (error) {
    console.error("Add Product Error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};

// UPDATE PRODUCT
export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      name,
      price,
      offerPrice,
      description,
      category,
      isDealOfDay,
      inStock,
      tags,
      keepImages,
      stock,
      stockThreshold,
    } = req.body;

    const newImages =
      req.files && req.files.length > 0
        ? await Promise.all(req.files.map(uploadToCloudinary))
        : [];

    const product = await productService.getProductById(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const updateData = {};

    if (name) updateData.name = name;
    if (price) updateData.price = price;
    if (offerPrice) updateData.offerPrice = offerPrice;
    if (description) updateData.description = description;
    if (category) updateData.category = category;
    if (stock !== undefined) updateData.stock = Number(stock);
    if (stockThreshold !== undefined)
      updateData.stockThreshold = Number(stockThreshold);

    if (isDealOfDay !== undefined) {
      updateData.isDealOfDay =
        String(isDealOfDay).toLowerCase() === "true";
    }

    if (inStock !== undefined) {
      updateData.inStock =
        String(inStock).toLowerCase() === "true";
    }

    let tagList = product.tags;

    if (tags !== undefined) {
      tagList = Array.isArray(tags)
        ? tags
        : tags
        ? tags.split(",").map((t) => t.trim())
        : [];

      updateData.tags = tagList;
    }

    let imagesToKeep = [];

    if (keepImages) {
      try {
        imagesToKeep = JSON.parse(keepImages);
      } catch {
        imagesToKeep = Array.isArray(keepImages)
          ? keepImages
          : [keepImages];
      }
    }

    const removedImages = product.images.filter(
      (img) => !imagesToKeep.includes(img)
    );

    updateData.images = [...imagesToKeep, ...newImages];

    // Regenerate embedding if text-related fields changed
    if (name || category || description || tags) {
      const text = `
        ${name || product.name}
        ${category || product.category}
        ${description || product.description}
        ${tagList.join(" ")}
      `.trim();

      updateData.embedding = await embedText(text);
    }

    const updatedProduct = await productService.updateProduct(
      id,
      updateData
    );

    if (removedImages.length > 0) {
      await productService.deleteFiles(removedImages);
    }

    res.status(200).json({
      success: true,
      message: "Product updated successfully",
      product: updatedProduct,
    });
  } catch (error) {
    console.error("Update Product Error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};

// DELETE PRODUCT
export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await productService.deleteProduct(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};

// GET ALL PRODUCTS
export const getProducts = async (req, res) => {
  try {
    const products = await productService.getAllProducts();
    res.status(200).json({ success: true, products });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};

// GET PRODUCT BY ID
export const getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await productService.getProductById(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.status(200).json({ success: true, product });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};

// CHANGE STOCK
export const changeStock = async (req, res) => {
  try {
    const { id, inStock } = req.body;
    const product = await productService.toggleStock(id, inStock);

    res.status(200).json({
      success: true,
      product,
      message: "Stock updated successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};

// SEARCH PRODUCTS
export const searchProducts = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q) {
      return res.status(200).json({
        success: true,
        products: [],
      });
    }

    const products = await productService.searchProducts(q);

    res.status(200).json({
      success: true,
      products,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};