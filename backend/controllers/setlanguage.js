import { getSession } from "../utils/sessionStore.js";

export const setLanguage = (req, res) => {
    const { sessionId, language } = req.body;

    if (!sessionId || !language) {
        return res.status(400).json({
            success: false,
            message: "SessionId and language required",
        });
    }

    const session = getSession(sessionId);

    session.language = language;

    console.log("🌐 Language set:", language);

    return res.json({
        success: true,
        message:
            language === "mr"
                ? "भाषा मराठी निवडली आहे."
                : "Language set to English.",
    });
};