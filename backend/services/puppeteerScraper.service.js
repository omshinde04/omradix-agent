import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const DATA_PATH = path.resolve("./data/ai_ready_data.json");
const MAX_PAGES = 100;

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
// 📁 ENSURE DIR
// ===============================
const ensureDir = () => {
    const dir = path.dirname(DATA_PATH);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
};

// ===============================
// 🔗 LINK FILTER (VERY IMPORTANT 🔥)
// ===============================
const isValidLink = (link, baseUrl) => {
    if (!link) return false;

    const lower = link.toLowerCase();

    // ❌ skip files
    if (
        lower.endsWith(".pdf") ||
        lower.endsWith(".jpg") ||
        lower.endsWith(".jpeg") ||
        lower.endsWith(".png") ||
        lower.endsWith(".svg") ||
        lower.endsWith(".zip") ||
        lower.endsWith(".doc") ||
        lower.endsWith(".docx") ||
        lower.endsWith(".xls") ||
        lower.endsWith(".xlsx")
    ) return false;

    // ❌ skip anchors
    if (link.includes("#")) return false;

    // ❌ skip query params (optional but recommended)
    if (link.includes("?")) return false;

    // ✅ only same domain
    if (!link.startsWith(baseUrl)) return false;

    return true;
};

// ===============================
// 🌐 MAIN SCRAPER
// ===============================
export const scrapeWithPuppeteer = async (startUrl) => {

    const browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    const page = await browser.newPage();

    const visited = new Set();
    const queue = [startUrl];
    const content = [];

    while (queue.length && visited.size < MAX_PAGES) {
        const url = queue.shift();

        if (!url || visited.has(url)) continue;

        console.log(`🔍 [${visited.size + 1}] ${url}`);

        try {
            await page.goto(url, {
                waitUntil: "networkidle2",
                timeout: 30000,
            });

            visited.add(url);

            // ===============================
            // ❌ REMOVE JUNK
            // ===============================
            await page.evaluate(() => {
                document.querySelectorAll(
                    "script, style, nav, footer, header, noscript"
                ).forEach(el => el.remove());
            });

            // ===============================
            // 🔥 ADVANCED EXTRACTION
            // ===============================
            const texts = await page.evaluate(() => {
                const selectors = [
                    "h1", "h2", "h3", "h4",
                    "p", "li",
                    "td", "th",
                    "span",
                    "div"
                ];

                let result = [];

                selectors.forEach(selector => {
                    document.querySelectorAll(selector).forEach(el => {
                        const text = el.innerText;
                        if (text) result.push(text);
                    });
                });

                return result;
            });

            texts.forEach((t) => {
                const text = cleanText(t);

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
                        source: url,
                    });
                }
            });

            // ===============================
            // 🔗 GET LINKS (FIXED 🔥)
            // ===============================
            const links = await page.evaluate(() =>
                Array.from(document.querySelectorAll("a"))
                    .map(a => a.href)
            );

            links.forEach(link => {
                if (
                    isValidLink(link, startUrl) &&
                    !visited.has(link) &&
                    !queue.includes(link)
                ) {
                    queue.push(link);
                }
            });

        } catch {
            console.warn("⚠️ Failed:", url);
        }
    }

    await browser.close();

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
    // 🔥 MERGE CONTEXT
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

    console.log("\n✅ DONE (PUPPETEER)");
    console.log("📄 Pages:", visited.size);
    console.log("🧠 Raw:", content.length);
    console.log("🧠 Final:", finalData.length);
    console.log("💾 Saved:", DATA_PATH);

    return finalData;
};