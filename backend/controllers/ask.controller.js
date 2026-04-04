import crypto from "crypto";
import { getCache, setCache } from "../utils/cache.js";
import { getSession } from "../utils/sessionStore.js";
import { generateAIAnswer } from "../services/ai.service.js";

// ============================================
// 🔐 CACHE KEY
// ============================================
function generateCacheKey({ websiteId, language, query, version = "v7" }) {
    return crypto
        .createHash("sha256")
        .update(`${websiteId}-${version}-${language}-${query}`)
        .digest("hex");
}

// ============================================
// 🧠 INTENT DETECTION
// ============================================
const detectIntent = (query) => {
    const q = query.toLowerCase().trim();

    if (q.includes("thank") || q.includes("thanks") || q.includes("धन्यवाद")) {
        return "thanks";
    }

    if (["ok", "okay", "nice", "good", "great"].includes(q)) {
        return "ack";
    }

    if (q === "hi" || q === "hello" || q === "नमस्कार") {
        return "greeting";
    }

    if (q.includes("bye") || q.includes("goodbye") || q.includes("निघतो")) {
        return "bye";
    }

    return "question";
};

// ============================================
// 🎯 MAIN CONTROLLER
// ============================================
export const handleAsk = async (req, res) => {
    const startTime = Date.now();

    try {
        let { query, sessionId } = req.body;

        if (!query || typeof query !== "string") {
            return res.json({ text: "Please ask something." });
        }

        if (!sessionId) {
            return res.json({ text: "Session error." });
        }

        const cleanedQuery = query.trim();

        if (cleanedQuery.length < 2) {
            return res.json({ text: "Please say something clearly." });
        }

        const session = getSession(sessionId);

        // ============================================
        // 🌐 LANGUAGE CHECK
        // ============================================
        if (!session.language) {
            return res.json({
                text: "Please select language first.",
                requireLanguage: true,
            });
        }

        let lang = session.language;
        const lower = cleanedQuery.toLowerCase();

        // ============================================
        // 🔥 LANGUAGE SWITCH FIX (CRITICAL)
        // ============================================

        // 👉 SWITCH TO MARATHI
        if (
            lower.includes("marathi") ||
            lower.includes("मराठी") ||
            lower.includes("marathit")
        ) {
            session.language = "mr";

            return res.json({
                text: "ठीक आहे, आता मी मराठीत बोलेन 😊",
            });
        }

        // 👉 SWITCH TO ENGLISH
        if (
            lower.includes("english") ||
            lower.includes("इंग्रजी")
        ) {
            session.language = "en";

            return res.json({
                text: "Switched to English 😊",
            });
        }

        // ============================================
        // ⚡ INTENT HANDLING
        // ============================================
        const intent = detectIntent(cleanedQuery);

        if (intent === "greeting") {
            return res.json({
                text:
                    lang === "mr"
                        ? session.userName
                            ? `नमस्कार ${session.userName}! मी तुम्हाला कशी मदत करू शकतो?`
                            : "नमस्कार! मी तुम्हाला कशी मदत करू शकतो?"
                        : session.userName
                            ? `Hello ${session.userName}! How can I help you?`
                            : "Hello! How can I help you?",
            });
        }

        if (intent === "ack") {
            return res.json({
                text: lang === "mr" ? "ठीक आहे 👍" : "Alright 👍",
            });
        }

        if (intent === "thanks") {
            return res.json({
                text:
                    lang === "mr"
                        ? "तुमचे स्वागत आहे 😊 अजून काही मदत हवी आहे का?"
                        : "You're welcome 😊 Let me know if you need anything else!",
            });
        }

        if (intent === "bye") {
            return res.json({
                text:
                    lang === "mr"
                        ? "ठीक आहे, पुन्हा भेटूया! 😊"
                        : "Alright, talk to you later! 😊",
            });
        }

        // ============================================
        // 👤 NAME FLOW
        // ============================================
        if (cleanedQuery === "__start__") {
            session.stage = "ask_name";

            return res.json({
                text:
                    lang === "mr"
                        ? "नमस्कार! मी तुमचा AI सहाय्यक आहे. तुमचं नाव काय आहे?"
                        : "Hello! I'm your AI assistant. What is your name?",
            });
        }

        if (session.stage === "ask_name") {
            let name = cleanedQuery;

            if (lang === "mr") {
                name = name
                    .replace(/माझं नाव आहे|माझे नाव आहे|माझं नाव|मी आहे|मी|नाव/gi, "")
                    .trim();
            } else {
                name = name
                    .replace(/my name is|i am|this is/gi, "")
                    .trim();
            }

            name = name.split(" ")[0];

            name =
                name.charAt(0).toUpperCase() +
                name.slice(1).toLowerCase();

            session.userName = name;
            session.stage = "chat";

            return res.json({
                text:
                    lang === "mr"
                        ? `नमस्कार ${name}! मी तुम्हाला कशी मदत करू शकतो?`
                        : `Hi ${name}! How can I help you today?`,
            });
        }

        // ============================================
        // ⚡ CACHE
        // ============================================
        const cacheKey = generateCacheKey({
            websiteId: session.websiteId || "default",
            language: lang,
            query: cleanedQuery.toLowerCase(),
        });

        const cached = getCache(cacheKey);
        if (cached?.text) {
            return res.json({ text: cached.text, cached: true });
        }

        // ============================================
        // 🤖 AI CALL
        // ============================================
        let aiText = await generateAIAnswer(cleanedQuery, lang);

        if (!aiText || aiText.length < 5) {
            aiText =
                lang === "mr"
                    ? "माफ करा, मला संबंधित माहिती सापडली नाही."
                    : "Sorry, I couldn't find that information.";
        }

        // ============================================
        // ⚡ CACHE SAVE
        // ============================================
        setCache(cacheKey, { text: aiText }, 900);

        console.log(`🧠 ASK DONE (${Date.now() - startTime}ms)`);

        return res.json({
            text: session.userName
                ? `${session.userName}, ${aiText}`
                : aiText,
        });

    } catch (err) {
        console.error("❌ ASK ERROR:", err.message);
        return res.json({ text: "Something went wrong." });
    }
};