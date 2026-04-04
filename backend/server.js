import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import morgan from "morgan";

import askRoutes from "./routes/ask.routes.js";
import voiceRoutes from "./routes/voice.routes.js";
import ttsRoutes from "./routes/tts.routes.js";
import languageRoutes from "./routes/language.routes.js"; // ✅ NEW

import { errorHandler } from "./middlewares/error.middleware.js";

const app = express();

// ===============================
// 🔍 DEBUG ENV
// ===============================
const apiKey = process.env.SARVAM_API_KEY;

if (!apiKey) {
    console.error("❌ SARVAM_API_KEY is NOT set");
} else {
    console.log(
        "✅ API KEY LOADED:",
        apiKey.substring(0, 6) + "********"
    );
}

// ===============================
// 🔐 SAFETY HANDLERS
// ===============================
process.on("unhandledRejection", (err) => {
    console.error("❌ Unhandled Rejection:", err);
});

process.on("uncaughtException", (err) => {
    console.error("❌ Uncaught Exception:", err);
});

// ===============================
// 🔧 MIDDLEWARE
// ===============================
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("tiny"));

app.use((req, res, next) => {
    res.setHeader("Connection", "keep-alive");
    next();
});

// ===============================
// ❤️ HEALTH
// ===============================
app.get("/", (req, res) => {
    res.json({
        status: "OK",
        message: "🚀 Omradix AI Assistant Running",
        uptime: process.uptime(),
    });
});

app.get("/ping", (req, res) => res.send("pong"));

// ===============================
// 🛣 ROUTES
// ===============================
app.use("/api/ask", askRoutes);
app.use("/api/voice", voiceRoutes);
app.use("/api/tts", ttsRoutes);
app.use("/api/set-language", languageRoutes); // ✅ IMPORTANT

// ===============================
// ❌ 404
// ===============================
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "Route not found",
    });
});

// ===============================
// 🔥 ERROR HANDLER
// ===============================
app.use(errorHandler);

// ===============================
// 🚀 START SERVER
// ===============================
const PORT = process.env.PORT || 10000;

const startServer = async () => {
    try {
        console.log("🚀 Starting Omradix AI Server...");

        // ===============================
        // 📂 CHECK DATA FILE
        // ===============================
        console.log("📂 Checking AI data...");

        const fs = await import("fs");
        const path = await import("path");

        const dataPath = path.resolve("./data/ai_ready_data.json");

        if (!fs.existsSync(dataPath)) {
            console.warn("⚠️ ai_ready_data.json NOT found");
            console.warn("👉 Run: node scrape.js");
        } else {
            console.log("✅ AI data loaded");
        }

        console.log("✅ AI system ready");

        const server = app.listen(PORT, "0.0.0.0", () => {
            console.log(`🌍 Server live on port ${PORT}`);
        });

        // ===============================
        // 🛑 SHUTDOWN
        // ===============================
        const shutdown = (signal) => {
            console.log(`🛑 ${signal} received. Shutting down...`);
            server.close(() => {
                console.log("✅ Server closed");
                process.exit(0);
            });
        };

        process.on("SIGINT", shutdown);
        process.on("SIGTERM", shutdown);

    } catch (error) {
        console.error("❌ Failed to start server:", error.message);
        process.exit(1);
    }
};

startServer();