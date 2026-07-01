import express from "express";
import {sellerLogin,sellerLogout,isAuthSeller, getDashboardData} from "../controllers/seller.controller.js";
import {authSeller} from "../middlewares/authSeller.js";

const router=express.Router();

router.post("/login",sellerLogin);
router.get("/is-auth",authSeller,isAuthSeller);
router.post("/logout", sellerLogout);
router.get("/logout", sellerLogout);
router.get("/dashboard", authSeller, getDashboardData);

export default router;

