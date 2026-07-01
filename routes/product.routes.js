import express from "express";
import { addProduct, getProducts, getProductById, changeStock, updateProduct, deleteProduct } from "../controllers/product.controller.js";
import * as productController from "../controllers/product.controller.js";
import { authSeller } from "../middlewares/authSeller.js";
import { upload } from "../config/multer.js";

const router = express.Router();

router.post("/", authSeller, upload.array("images"), productController.addProduct);
router.get("/", productController.getProducts);
router.get("/search", productController.searchProducts);
router.get("/:id", productController.getProductById);
router.post("/stock", authSeller, productController.changeStock);
router.put("/:id", authSeller, upload.array("images"), productController.updateProduct);
router.delete("/:id", authSeller, productController.deleteProduct);

export default router;
