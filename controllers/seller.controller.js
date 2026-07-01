import jwt from "jsonwebtoken";
import Order from "../models/order.model.js";
import Product from "../models/product.models.js";
import mongoose from "mongoose";

///// logout seller : /api/seller/login

export const sellerLogin = async(req, res) => {
  try  {
    const { email, password } = req.body;
    const sellerEmail = process.env.SELLER_EMAIL?.trim().toLowerCase();
    const sellerPassword = process.env.SELLER_PASSWORD;
    const loginEmail = email?.trim().toLowerCase();

    if (!sellerEmail || !sellerPassword || !process.env.JWT_SECRET) {
      return res
        .status(500)
        .json({ message: "Seller login is not configured", success: false });
    }

    if (
      loginEmail !== sellerEmail ||
      password !== sellerPassword
    ) {
      return res
        .status(401)
        .json({ message: "Invalid seller credentials", success: false });
    }

    const token = jwt.sign(
      { email: sellerEmail, role: "seller" },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.cookie("sellerToken", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({ message: "Login successful", success: true, token });
  } catch (error) {
    console.error("Error in sellerLogin:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};


///// logout seller : /api/seller/logout

export const sellerLogout = async (req, res) => {
  try {
    res.clearCookie("sellerToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    });
    res.status(200).json({message: "Logout successful", success: true });
  } catch (error) {
    console.error("Error in sellerLogout:", error);
    res.status(500).json({message: "Internal server error" });
  }
};


//check auth seller : /api/seller/is-auth

export const isAuthSeller = async(req, res) => {
  try {
      res.status(200).json({
      success:true,
     });     
    } catch (error) {
      console.error("Error in isAuthSeller:", error);
      res.status(500).json({message: "Internal server error" });
  }
};

export const getDashboardData = async (req, res) => {
  try {
    console.log("DEBUG - Dashboard Access by Seller:", req.seller);
    // 1. Basic Stats
    const totalOrders = await Order.countDocuments({
      $or: [{ paymentType: "COD" }, { isPaid: true }],
    });
    const totalProducts = await Product.countDocuments({});
    
    const orders = await Order.find({
      $or: [{ paymentType: "COD" }, { isPaid: true }],
    });
    
    const totalSales = orders.reduce((acc, order) => acc + order.amount, 0);

    const lowStockProducts = await Product.find({
        $expr: { $lt: ["$stock", "$stockThreshold"] }
    });

    // 2. Sales Over Time (Last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const salesOverTime = await Order.aggregate([
      {
        $match: {
          $or: [{ paymentType: "COD" }, { isPaid: true }],
          createdAt: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          sales: { $sum: "$amount" },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // 3. Category-wise Sales
    const categorySalesRaw = await Order.aggregate([
      { $match: { $or: [{ paymentType: "COD" }, { isPaid: true }] } },
      { $unwind: "$items" },
      {
        $lookup: {
          from: "products",
          let: { productId: "$items.product" },
          pipeline: [
            { 
                $match: { 
                    $expr: { 
                        $eq: [
                            "$_id", 
                            { $convert: { input: "$$productId", to: "objectId", onError: null, onNull: null } }
                        ] 
                    } 
                } 
            }
          ],
          as: "productDetails"
        }
      },
      { $unwind: "$productDetails" },
      {
        $group: {
          _id: "$productDetails.category",
          value: { 
            $sum: { 
              $multiply: [
                { $toDouble: "$productDetails.offerPrice" }, 
                "$items.quantity"
              ] 
            } 
          }
        }
      }
    ]);

    // 4. Top Selling Products
    const topProductsRaw = await Order.aggregate([
        { $match: { $or: [{ paymentType: "COD" }, { isPaid: true }] } },
        { $unwind: "$items" },
        {
          $group: {
            _id: "$items.product",
            quantity: { $sum: "$items.quantity" }
          }
        },
        { $sort: { quantity: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: "products",
            let: { productId: "$_id" },
            pipeline: [
              { 
                  $match: { 
                      $expr: { 
                          $eq: [
                              "$_id", 
                              { $convert: { input: "$$productId", to: "objectId", onError: null, onNull: null } }
                          ] 
                      } 
                  } 
              }
            ],
            as: "productDetails"
          }
        },
        { $unwind: "$productDetails" },
        {
          $project: {
            name: "$productDetails.name",
            quantity: 1
          }
        }
      ]);

    // 5. Inventory Stats - Non-overlapping categories
    const outOfStock = await Product.countDocuments({ stock: 0 });
    const lowStockCount = await Product.countDocuments({ 
        $and: [
            { stock: { $gt: 0 } },
            { $expr: { $lt: ["$stock", "$stockThreshold"] } }
        ]
    });
    const healthyStock = await Product.countDocuments({ 
        $expr: { $gte: ["$stock", "$stockThreshold"] } 
    });

    // 6. Recent Orders
    const recentOrders = await Order.find({
        $or: [{ paymentType: "COD" }, { isPaid: true }],
    })
    .sort({ createdAt: -1 })
    .limit(5)
    .populate("items.product");

    res.status(200).json({
      success: true,
      stats: {
        totalSales,
        totalOrders,
        totalProducts,
        lowStockCount // This is used for the summary card
      },
      salesOverTime: (salesOverTime || []).map(item => ({ date: item?._id || "Unknown", sales: item?.sales || 0 })),
      categorySales: (categorySalesRaw || []).map(item => ({ name: item?._id || "Uncategorized", value: item?.value || 0 })),
      topProducts: (topProductsRaw || []).map(item => ({ name: item?.name || "Product", quantity: item?.quantity || 0 })),
      inventoryStats: [
        { name: "Healthy Stock", value: healthyStock || 0 },
        { name: "Low Stock", value: lowStockCount || 0 },
        { name: "Out of Stock", value: outOfStock || 0 }
      ],
      recentOrders: recentOrders || [],
      lowStockProducts: (lowStockProducts || []).slice(0, 5)
    });
  } catch (error) {
    console.error("DEBUG - Seller Dashboard Error:", error);
    res.status(500).json({ 
        success: false, 
        message: "Failed to fetch dashboard data",
        error: error.message 
    });
  }
};










