import dotenv from "dotenv";
dotenv.config();

import { scrapeWebsite } from "./services/scraper.service.js";
import { scrapeWithPuppeteer } from "./services/puppeteerScraper.service.js";

const URL = process.env.SCRAPER_URL;
const SCRAPER_TYPE = process.env.SCRAPER_TYPE || "puppeteer";

const run = async () => {
    console.log("🚀 Scraper starting...\n");
    console.log("🧠 Mode:", SCRAPER_TYPE);

    let data;

    if (SCRAPER_TYPE === "cheerio") {
        console.log("⚡ Using Cheerio (fast static scraper)");
        data = await scrapeWebsite(URL);
    } else {
        console.log("🧠 Using Puppeteer (dynamic scraper)");
        data = await scrapeWithPuppeteer(URL);
    }

    console.log("\n✅ Finished");
    console.log("📄 Items:", data.length);

    process.exit(0);
};

run();