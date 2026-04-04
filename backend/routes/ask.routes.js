import express from "express";
import rateLimit from "express-rate-limit";
import { handleAsk } from "../controllers/ask.controller.js";
import { handleAskStream } from "../controllers/ask.stream.controller.js"; // ✅ NEW
import asyncHandler from "../middlewares/asyncHandler.js";

const router = express.Router();

// ===============================
// 🚀 RATE LIMITER (PRODUCTION SAFE)
// ===============================
const askLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30, // max 30 requests per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many requests. Please try again after a minute.",
    },
});

// ===============================
// 🧠 NORMAL ASK (EXISTING - SAFE)
// ===============================
router.post(
    "/",
    askLimiter,
    asyncHandler(handleAsk)
);

// ===============================
// ⚡ STREAM ASK (NEW 🔥)
// ===============================
router.post(
    "/stream",
    askLimiter,
    handleAskStream // ❗ DO NOT wrap in asyncHandler (streaming breaks)
);

export default router;