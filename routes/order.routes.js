import express from "express";
import {authUser} from "../middlewares/authUser.js";
import {
  getAllOrders,
  getUserOrders,
  placeOrderCOD,
  updateOrderApproval,
  updateOrderStatus,
} from "../controllers/order.controller.js";
import { authSeller } from "../middlewares/authSeller.js";

const router = express.Router();
router.post("/cod", authUser, placeOrderCOD);
router.get("/user", authUser, getUserOrders);
router.get("/seller", authSeller, getAllOrders);
router.post("/approval", authSeller, updateOrderApproval);
router.post("/status", authSeller, updateOrderStatus);

export default router;
