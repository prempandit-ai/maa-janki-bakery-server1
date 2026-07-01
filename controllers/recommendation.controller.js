import Interaction from "../models/interaction.model.js";
import Product from "../models/product.models.js";

// ---------------- CACHE ----------------
const cache = {
  similarProducts: {},
  userRecommendations: {},
  cartRecommendations: {},
  expiry: {},
};

const CACHE_DURATION = 10 * 60 * 1000; // 10 mins

const getFromCache = (type, key) => {
  const entry = cache[type][key];
  if (entry && Date.now() < cache.expiry[type + key]) {
    return entry;
  }
  return null;
};

const setInCache = (type, key, data) => {
  cache[type][key] = data;
  cache.expiry[type + key] = Date.now() + CACHE_DURATION;
};

// ---------------- COSINE SIMILARITY ----------------
const cosineSimilarity = (vecA, vecB) => {
  if (!vecA || !vecB) return 0;
  if (vecA.length !== vecB.length) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) return 0;

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
};

// ---------------- TRACK INTERACTION ----------------
export const trackInteraction = async (req, res) => {
  try {
    const { productId, action } = req.body;
    const userId = req.user?._id || req.user;

    const interaction = new Interaction({
      userId,
      productId,
      action,
    });

    await interaction.save();

    res.status(200).json({
      success: true,
    });
  } catch (error) {
    console.error("Tracking failed:", error);
    res.status(500).json({
      success: false,
      message: "Tracking failed",
    });
  }
};

// ---------------- SIMILAR PRODUCTS ----------------
export const getSimilarProducts = async (req, res) => {
  try {
    const { productId } = req.params;

    const cached = getFromCache("similarProducts", productId);
    if (cached) {
      return res.status(200).json({
        success: true,
        products: cached,
      });
    }

    const currentProduct = await Product.findById(productId);

    if (!currentProduct) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const products = await Product.find({
      _id: { $ne: productId },
    });

    const scoredProducts = products.map((product) => ({
      product,
      score: cosineSimilarity(
        currentProduct.embedding,
        product.embedding
      ),
    }));

    scoredProducts.sort((a, b) => b.score - a.score);

    const recommendations = scoredProducts
      .slice(0, 5)
      .map((item) => item.product);

    setInCache("similarProducts", productId, recommendations);

    res.status(200).json({
      success: true,
      products: recommendations,
    });
  } catch (error) {
    console.error("Get similar failed:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ---------------- CART RECOMMENDATIONS ----------------
export const getCartRecommendations = async (req, res) => {
  try {
    const { productIds } = req.body;

    if (!productIds || productIds.length === 0) {
      return res.status(200).json({
        success: true,
        products: [],
      });
    }

    const cacheKey = [...productIds].sort().join(",");

    const cached = getFromCache(
      "cartRecommendations",
      cacheKey
    );

    if (cached) {
      return res.status(200).json({
        success: true,
        products: cached,
      });
    }

    const cartProducts = await Product.find({
      _id: { $in: productIds },
    });

    const otherProducts = await Product.find({
      _id: { $nin: productIds },
    });

    const candidateScores = {};

    for (const cartProduct of cartProducts) {
      for (const product of otherProducts) {
        const score = cosineSimilarity(
          cartProduct.embedding,
          product.embedding
        );

        candidateScores[product._id] =
          (candidateScores[product._id] || 0) + score;
      }
    }

    const sortedIds = Object.keys(candidateScores)
      .sort((a, b) => candidateScores[b] - candidateScores[a])
      .slice(0, 5);

    const products = await Product.find({
      _id: { $in: sortedIds },
    });

    const sortedProducts = sortedIds
      .map((id) =>
        products.find((p) => p._id.toString() === id)
      )
      .filter(Boolean);

    setInCache(
      "cartRecommendations",
      cacheKey,
      sortedProducts
    );

    res.status(200).json({
      success: true,
      products: sortedProducts,
    });
  } catch (error) {
    console.error("Cart recommendation failed:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ---------------- USER RECOMMENDATIONS ----------------
export const getUserRecommendations = async (req, res) => {
  try {
    const userId = req.user?._id || req.user;

    if (!userId) {
      const popular = await Product.find().limit(5);
      return res.status(200).json({
        success: true,
        products: popular,
      });
    }

    const cached = getFromCache(
      "userRecommendations",
      userId.toString()
    );

    if (cached) {
      return res.status(200).json({
        success: true,
        products: cached,
      });
    }

    const interactions = await Interaction.find({ userId })
      .sort({ timestamp: -1 })
      .limit(20);

    if (interactions.length === 0) {
      const popular = await Product.find().limit(5);
      return res.status(200).json({
        success: true,
        products: popular,
      });
    }

    const weights = {
      purchase: 1.0,
      add_to_cart: 0.8,
      click: 0.4,
      view: 0.2,
    };

    const productIds = interactions.map(
      (i) => i.productId
    );

    const interactedProducts = await Product.find({
      _id: { $in: productIds },
    });

    const productMap = {};
    interactedProducts.forEach((p) => {
      productMap[p._id.toString()] = p;
    });

    let userVector = new Array(384).fill(0);
    let totalWeight = 0;

    for (const interaction of interactions) {
      const product =
        productMap[interaction.productId.toString()];

      if (!product || !product.embedding) continue;

      const weight =
        weights[interaction.action] || 0.1;

      for (let i = 0; i < 384; i++) {
        userVector[i] += product.embedding[i] * weight;
      }

      totalWeight += weight;
    }

    if (totalWeight === 0) {
      const popular = await Product.find().limit(5);
      return res.status(200).json({
        success: true,
        products: popular,
      });
    }

    userVector = userVector.map(
      (v) => v / totalWeight
    );

    const interactedSet = new Set(
      productIds.map((id) => id.toString())
    );

    const allProducts = await Product.find({
      _id: { $nin: productIds },
    });

    const scoredProducts = allProducts.map((product) => ({
      product,
      score: cosineSimilarity(
        userVector,
        product.embedding
      ),
    }));

    scoredProducts.sort((a, b) => b.score - a.score);

    const recommendations = scoredProducts
      .slice(0, 8)
      .map((item) => item.product);

    setInCache(
      "userRecommendations",
      userId.toString(),
      recommendations
    );

    res.status(200).json({
      success: true,
      products: recommendations,
    });
  } catch (error) {
    console.error("User recommendation failed:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};