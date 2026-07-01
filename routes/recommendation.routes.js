
import express from "express";
import { 
    trackInteraction, 
    getSimilarProducts, 
    getCartRecommendations, 
    getUserRecommendations 
} from "../controllers/recommendation.controller.js";
import { authUser } from "../middlewares/authUser.js";
import { optionalAuth } from "../middlewares/optionalAuth.js";

const router = express.Router();
// Public/Optional Auth
router.post("/track", optionalAuth, trackInteraction);

router.get("/similar/:productId", getSimilarProducts);

router.post("/cart", getCartRecommendations);

// Optional Auth for personalized (fallbacks to popular)
router.get("/user", optionalAuth, getUserRecommendations);

export default router;
