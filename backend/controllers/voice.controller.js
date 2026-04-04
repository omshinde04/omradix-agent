import { speechToText } from "../services/stt.service.js";
import { handleAsk } from "./ask.controller.js";
import { getSession } from "../utils/sessionStore.js";

// ===============================
// 🧠 LIGHT LANGUAGE DETECTION (FAST ⚡)
// ===============================
const detectLanguageSmart = (text = "", prevLang = "en") => {
    if (/[\u0900-\u097F]/.test(text)) return "mr";
    return prevLang;
};

// ===============================
// 🎤 VOICE CONTROLLER (ORIGINAL WORKING)
// ===============================
export const handleVoice = async (req, res) => {
    try {
        const startTime = Date.now();

        console.log("\n==============================");
        console.log("🎤 /api/voice REQUEST");

        const file = req.file;
        const { sessionId } = req.body;

        if (!sessionId) {
            return res.status(400).json({
                success: false,
                message: "Session ID required",
            });
        }

        const session = getSession(sessionId);

        // ===============================
        // 🤖 GREETING FLOW
        // ===============================
        if (!file) {
            console.log("🤖 Greeting flow");

            return handleAsk(
                { body: { query: "__start__", sessionId } },
                res
            );
        }

        // ===============================
        // 🎤 STT PROCESS
        // ===============================
        console.log("🎤 Running STT...");

        const sttResult = await speechToText(
            file.path,
            session.language
        );

        let userText = sttResult?.text?.trim() || "";

        console.log("📝 User:", userText);

        // ===============================
        // ❗ EMPTY INPUT
        // ===============================
        if (!userText || userText.length < 2) {
            return res.json({
                success: true,
                userText: "",
                text:
                    session.language === "mr"
                        ? "माफ करा, मला समजले नाही. कृपया पुन्हा बोला."
                        : "Sorry, I didn’t catch that. Please speak again.",
                language: session.language,
            });
        }

        // ===============================
        // 🌐 LANGUAGE (LOCKED)
        // ===============================
        const lang = session.language;

        console.log("🌐 Language:", lang);

        // ===============================
        // 🤖 AI RESPONSE (MAIN FLOW)
        // ===============================
        const fakeReq = {
            body: {
                query: userText,
                sessionId,
            },
        };

        const fakeRes = {
            json: (data) => {
                console.log(`⚡ Voice Done (${Date.now() - startTime}ms)`);

                return res.json({
                    success: true,
                    userText,
                    text: data.text,
                    language: lang,
                });
            },
            status: (code) => res.status(code),
        };

        return handleAsk(fakeReq, fakeRes);

    } catch (error) {
        console.error("\n❌ VOICE ERROR:", error.message);
        console.log("==============================\n");

        return res.status(500).json({
            success: false,
            message: "Voice processing failed",
        });
    }
};