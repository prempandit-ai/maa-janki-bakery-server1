import express from "express";
import {registerUser,loginUser,googleAuthUser,logoutUser,isAuthUser, uploadAvatar, deleteAvatar, updateUserProfile} from "../controllers/user.controller.js";
import {authUser} from "../middlewares/authUser.js";
import { optionalAuth } from "../middlewares/optionalAuth.js";
import { upload } from "../config/multer.js";

const router=express.Router();
  
 router.post("/register",registerUser);
 router.post("/login",loginUser);
 router.post("/google",googleAuthUser);
router.post("/logout", logoutUser);
router.get("/logout", logoutUser);
router.get("/is-auth",optionalAuth,isAuthUser);
router.post("/avatar", authUser, upload.single("avatar"), uploadAvatar);
router.delete("/avatar", authUser, deleteAvatar);
router.post("/update-profile", authUser, updateUserProfile);


export default router;

