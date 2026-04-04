import axios from "axios";
import * as cheerio from "cheerio";
import fs from "fs";
import path from "path";
import { URL } from "url";

// ===============================
// 📁 PATH
// ===============================
const DATA_PATH = path.resolve("./data/ai_ready_data.json");

// ===============================
// 🌐 CONFIG
// ===============================
const BASE_URL = process.env.SCRAPER_URL;
const MAX_PAGES = 100;
const REQUEST_DELAY = 800;

// ===============================
// 🌐 AXIOS
// ===============================
const client = axios.create({
    timeout: 15000,
    headers: {
        "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
    },
});

// ===============================
// ⏱️ DELAY
// ===============================
const delay = (ms) => new Promise((res) => setTimeout(res, ms));

// ===============================
// 🧹 CLEAN TEXT
// ===============================
const cleanText = (text) => {
    return text
        .replace(/\s+/g, " ")
        .replace(/\n+/g, " ")
        .replace(/[^\w\s.,₹()%/-]/g, "")
        .trim();
};

// ===============================
// 🔗 VALID URL
// ===============================
const isValidLink = (base, link) => {
    try {
        const baseHost = new URL(base).hostname;
        const url = new URL(link);

        if (url.hostname !== baseHost) return false;

        if (
            url.pathname.match(
                /\.(pdf|jpg|jpeg|png|gif|svg|mp4|zip|docx?|xlsx?)$/i
            )
        ) return false;

        return true;
    } catch {
        return false;
    }
};

// ===============================
// 📁 ENSURE DIR
// ===============================
const ensureDir = () => {
    const dir = path.dirname(DATA_PATH);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
};

// ===============================
// 🌐 SCRAPER
// ===============================
export const scrapeWebsite = async (customUrl) => {
    try {
        const startUrl = customUrl || BASE_URL;

        console.log("🚀 Starting scraper:", startUrl);

        const visited = new Set();
        const queue = [startUrl];
        const content = [];

        while (queue.length && visited.size < MAX_PAGES) {
            const currentUrl = queue.shift();

            if (!currentUrl || visited.has(currentUrl)) continue;

            console.log(`🔍 [${visited.size + 1}] ${currentUrl}`);

            try {
                const { data: html } = await client.get(currentUrl);

                const $ = cheerio.load(html);
                visited.add(currentUrl);

                // ===============================
                // ❌ REMOVE JUNK
                // ===============================
                $("script, style, nav, footer, header, noscript").remove();

                // ===============================
                // 🔥 ADVANCED EXTRACTION
                // ===============================
                const selectors = [
                    "h1", "h2", "h3", "h4",
                    "p", "li",
                    "td", "th",         // tables
                    "span",
                    "div"
                ];

                selectors.forEach(selector => {
                    $(selector).each((i, el) => {
                        let text = cleanText($(el).text());

                        if (
                            text.length > 40 &&
                            text.length < 500 &&
                            !text.match(/^(home|login|menu|search)$/i) &&
                            !text.includes("©") &&
                            !text.includes("cookie") &&
                            !text.includes("privacy policy")
                        ) {
                            content.push({
                                content: text,
                                source: currentUrl,
                            });
                        }
                    });
                });

                // ===============================
                // 🔗 LINKS
                // ===============================
                $("a").each((i, el) => {
                    let href = $(el).attr("href");
                    if (!href) return;

                    try {
                        href = new URL(href, currentUrl).href;
                    } catch {
                        return;
                    }

                    if (
                        isValidLink(startUrl, href) &&
                        !visited.has(href) &&
                        !queue.includes(href)
                    ) {
                        queue.push(href);
                    }
                });

                await delay(REQUEST_DELAY);

            } catch {
                console.warn("⚠️ Failed:", currentUrl);
            }
        }

        // ===============================
        // 🔥 SMART DEDUP
        // ===============================
        const unique = [
            ...new Map(
                content.map(item => [
                    item.content.toLowerCase().slice(0, 120),
                    item
                ])
            ).values()
        ];

        // ===============================
        // 🔥 MERGE CONTEXT (VERY IMPORTANT)
        // ===============================
        const merged = [];

        for (let i = 0; i < unique.length - 1; i++) {
            const combined =
                unique[i].content + " " + unique[i + 1].content;

            if (combined.length < 500) {
                merged.push({
                    content: combined,
                    source: unique[i].source
                });
            }
        }

        const finalData = [...unique, ...merged];

        // ===============================
        // 💾 SAVE
        // ===============================
        ensureDir();
        fs.writeFileSync(DATA_PATH, JSON.stringify(finalData, null, 2));

        console.log("\n✅ SCRAPING COMPLETE");
        console.log("📄 Pages:", visited.size);
        console.log("🧠 Raw:", content.length);
        console.log("🧠 Final:", finalData.length);
        console.log("💾 Saved:", DATA_PATH);

        return finalData;

    } catch (err) {
        console.error("❌ Scraper error:", err.message);
        return [];
    }
};