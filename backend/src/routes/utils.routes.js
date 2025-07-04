const express = require("express");
const { chromium } = require("playwright");
const router = express.Router();

// POST /api/utils/resolve-location
router.post("/resolve-location", async (req, res) => {
  const { input } = req.body;
  console.log("Received input:", input);
  if (!input) return res.status(400).json({ message: "Missing input" });

  try {
    // 1. Handle direct coordinates
    const coordMatch = input.match(/(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)/);
    if (coordMatch) {
      return res.json({
        lat: parseFloat(coordMatch[1]),
        lng: parseFloat(coordMatch[2]),
        method: "direct-coords"
      });
    }

    // 2. Scrape from Google Maps
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/101.0.4951.64 Safari/537.36",
    });
    const page = await context.newPage();

    let url = input;
    if (!input.startsWith("https://www.google.com/maps") && !/^https?:\/\//.test(input)) {
      url = `https://www.google.com/maps/search/${encodeURIComponent(input)}`;
    }

    console.log("Navigating to:", url);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

    // Wait for redirect (URL change) or for a map/info panel to appear
    let redirected = false;
    for (let i = 0; i < 10; i++) {
      await page.waitForTimeout(1000);
      const currentUrl = page.url();
      if (currentUrl !== url) {
        redirected = true;
        break;
      }
    }
    if (!redirected) {
      // Sometimes the URL doesn't change, but the map loads, so continue anyway
      await page.waitForTimeout(2000);
    }

    // Optionally, wait for a map or info panel element to appear
    try {
      await page.waitForSelector('button[aria-label^="Share"], div[role="main"]', { timeout: 5000 });
    } catch (e) {
      // Ignore if not found, fallback to URL/meta extraction
    }

    // Extract coordinates from current page URL
    const finalUrl = page.url();
    console.log("Final redirected URL:", finalUrl);

    let coords = null;
    let match =
      finalUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) ||
      finalUrl.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);

    if (match) {
      coords = {
        lat: parseFloat(match[1]),
        lng: parseFloat(match[2]),
      };
    }

    // Fallback 1: try to parse from og:image meta (used in Google Maps)
    if (!coords) {
      const meta = await page.$('meta[property="og:image"], meta[property="twitter:image"]');
      if (meta) {
        const content = await meta.getAttribute("content");
        const imgMatch = content?.match(/center=(-?\d+\.\d+)%2C(-?\d+\.\d+)/);
        if (imgMatch) {
          coords = {
            lat: parseFloat(imgMatch[1]),
            lng: parseFloat(imgMatch[2]),
          };
        }
      }
    }

    // Fallback 2: check data attributes (less reliable)
    if (!coords) {
      const el = await page.$("[data-lat][data-lng]");
      if (el) {
        const lat = await el.getAttribute("data-lat");
        const lng = await el.getAttribute("data-lng");
        if (lat && lng) {
          coords = { lat: parseFloat(lat), lng: parseFloat(lng) };
        }
      }
    }

    await browser.close();

    if (coords) {
      return res.json({ ...coords, method: "playwright-scrape" });
    }

    return res.status(404).json({ message: "Coordinates not found in Google Maps page." });
  } catch (err) {
    console.error(`Scraping error: ${err.stack}`);
    return res.status(500).json({ message: "Scraping failed", error: err.message });
  }
});

module.exports = router;
