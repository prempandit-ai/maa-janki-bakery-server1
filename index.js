import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import dotenv from "dotenv";
import path from "path";
import { connectDB } from "./config/connectDB.js";
import dns from "node:dns";
import { authLimiter, apiLimiter, chatbotLimiter } from "./middlewares/rateLimiter.js";
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4']);

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), "server", ".env") });
import userRoutes from "./routes/user.routes.js";
import sellerRoutes from "./routes/seller.routes.js";
import { connectCloudinary } from "./config/cloudinary.js";
import productRoutes from "./routes/product.routes.js";
import cartRoutes from "./routes/cart.routes.js";
import OrderRoutes from "./routes/order.routes.js";
import addressRoutes from "./routes/address.routes.js";
import recommendationRoutes from "./routes/recommendation.routes.js";
import chatbotRoutes from "./routes/chatbot.routes.js";



const app = express();

app.set("trust proxy", 1);

connectDB();
connectCloudinary();

const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://localhost:5174",
  "http://127.0.0.1:5174",
  process.env.FRONTEND_URL
].filter(Boolean);

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  // Allow any Vercel deployment (preview + production)
  if (origin.endsWith(".vercel.app")) return true;
  return false;
};

app.use(
  helmet({
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
app.use(express.json({ limit: "1mb" }));

app.use(
  cors({
    origin: function (origin, callback) {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "token"],
    exposedHeaders: ["Authorization", "token"],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  })
);
app.use(cookieParser());

app.use("/api/user/login", authLimiter);
app.use("/api/user/register", authLimiter);
app.use("/api/user/google", authLimiter);
app.use("/api/seller/login", authLimiter);
app.use("/api/chatbot", chatbotLimiter);
app.use("/api", apiLimiter);

//Api Endpoints  


const productsPath = path.join(process.cwd(), "products");
app.use("/products", express.static(productsPath));
app.use("/images", express.static(productsPath));
app.use("/uploads", express.static(productsPath));
app.use("/api/user", userRoutes);
app.use("/api/seller", sellerRoutes);
app.use("/api/products", productRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/order", OrderRoutes);
app.use("/api/address", addressRoutes);
app.use("/api/recommend", recommendationRoutes);
app.use("/api/chatbot", chatbotRoutes);

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => { console.log(`Server is running on port ${PORT}`); })
