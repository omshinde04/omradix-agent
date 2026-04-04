import { generateAIAnswer } from "../services/ai.service.js";
import { getSession } from "../utils/sessionStore.js";

export const handleAskStream = async (req, res) => {
    try {
        const { query, sessionId } = req.body;

        const session = getSession(sessionId);
        const lang = session.language || "en";

        // ===============================
        // 🔥 HEADERS FOR STREAM
        // ===============================
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        // ===============================
        // 🤖 GET FULL RESPONSE
        // ===============================
        const fullText = await generateAIAnswer(query, lang);

        // ===============================
        // ⚡ STREAM WORD BY WORD
        // ===============================
        const words = fullText.split(" ");

        for (let i = 0; i < words.length; i++) {
            const chunk = words[i] + " ";

            res.write(`data: ${chunk}\n\n`);

            await new Promise(r => setTimeout(r, 30)); // ⚡ typing speed
        }

        res.write("data: [DONE]\n\n");
        res.end();

    } catch (err) {
        console.error("❌ STREAM ERROR:", err.message);
        res.end();
    }
};