import express from "express";
import { setLanguage } from "../controllers/setlanguage.js";
import asyncHandler from "../middlewares/asyncHandler.js";

const router = express.Router();

// 🌐 SET LANGUAGE
router.post("/", asyncHandler(setLanguage));

export default router;