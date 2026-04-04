import axios from "axios";
import fs from "fs";
import path from "path";

const DATA_PATH = path.resolve("./data/ai_ready_data.json");

// ===============================
// ⚡ CACHE DATA (LOAD ONCE)
// ===============================
let cachedData = [];

const loadData = () => {
    try {
        if (cachedData.length) return cachedData;

        if (!fs.existsSync(DATA_PATH)) return [];

        const raw = fs.readFileSync(DATA_PATH, "utf-8");
        cachedData = JSON.parse(raw);

        return cachedData;
    } catch {
        return [];
    }
};

// ===============================
// 🔍 GENERIC SMART RETRIEVER (NO HARDCODING 🔥)
// ===============================
const getRelevantContext = (query, data) => {
    const cleanedQuery = query.toLowerCase().replace(/[^\w\s]/g, "");
    const words = cleanedQuery.split(/\s+/).filter(w => w.length > 2);

    const scored = data.map(item => {
        const text = item.content?.toLowerCase() || "";

        let score = 0;

        // word match scoring
        words.forEach(word => {
            if (text.includes(word)) score += 2;

            const regex = new RegExp(`\\b${word}\\b`, "g");
            if (regex.test(text)) score += 1;
        });

        // phrase match boost (VERY IMPORTANT 🔥)
        if (text.includes(cleanedQuery)) score += 5;

        // density scoring
        const matchCount = words.filter(word => text.includes(word)).length;
        score += matchCount;

        // remove junk lines
        if (text.length > 50 && text.length < 400) score += 1;

        return { ...item, score };
    });

    return scored
        .filter(i => i.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);
};

// ===============================
// 🌐 TRANSLATION (ONLY IF NEEDED)
// ===============================
const translateToEnglish = async (text) => {
    try {
        const res = await axios.post(
            "https://api.sarvam.ai/v1/chat/completions",
            {
                model: "sarvam-m",
                messages: [
                    {
                        role: "system",
                        content: "Translate to English only. No explanation."
                    },
                    {
                        role: "user",
                        content: text
                    }
                ]
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.SARVAM_API_KEY}`
                }
            }
        );

        return res.data.choices[0].message.content;
    } catch {
        return text;
    }
};

// ===============================
// 🤖 MAIN AI FUNCTION
// ===============================
export const generateAIAnswer = async (query, lang) => {
    const data = loadData();

    // ===============================
    // ⚡ STEP 1: DIRECT MATCH (FAST)
    // ===============================
    let context = getRelevantContext(query, data);

    // ===============================
    // 🌐 STEP 2: FALLBACK TRANSLATION (SMART)
    // ===============================
    if (lang === "mr" && context.length < 1) {
        const translatedQuery = await translateToEnglish(query);
        context = getRelevantContext(translatedQuery, data);
    }

    // ===============================
    // ❌ NO CONTEXT FOUND
    // ===============================
    if (!context.length) {
        return lang === "mr"
            ? "माफ करा, मला याबद्दल माहिती सापडली नाही. तुम्ही थोडं वेगळ्या प्रकारे विचारू शकता का?"
            : "Sorry, I couldn't find information about that. Could you rephrase your question?";
    }

    // ===============================
    // 🤖 PROMPT (HUMAN + CONTROLLED)
    // ===============================
    const prompt = `
You are a smart, friendly AI assistant for a website.

STYLE:
- Speak like a helpful human
- Be clear, simple, and slightly conversational
- Guide the user if needed

RULES:
- Answer ONLY from the given context
- DO NOT guess or add outside knowledge
- DO NOT include <think> or reasoning
- If partial info exists → explain clearly
- Keep answers concise (3–5 lines max)

LANGUAGE:
${lang === "mr" ? "Marathi" : "English"}

CONTEXT:
${context.map(c => c.content).join("\n\n")}

USER QUESTION:
${query}

FINAL ANSWER:
`;

    const response = await axios.post(
        "https://api.sarvam.ai/v1/chat/completions",
        {
            model: "sarvam-m",
            messages: [
                { role: "system", content: "You are a helpful assistant." },
                { role: "user", content: prompt }
            ]
        },
        {
            headers: {
                Authorization: `Bearer ${process.env.SARVAM_API_KEY}`
            }
        }
    );

    let aiText = response.data.choices[0].message.content;

    // ===============================
    // 🔥 CLEAN OUTPUT
    // ===============================
    aiText = aiText
        ?.replace(/<think[\s\S]*?<\/think>/gi, "")
        .replace(/\s+/g, " ")
        .trim();

    return aiText;
};