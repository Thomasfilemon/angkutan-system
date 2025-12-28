const express = require("express");
const { chromium } = require("playwright");
const router = require("express").Router();

// Helper function to parse Google Maps URL without browser
function parseGoogleMapsUrl(url) {
  // Pattern 1: @lat,lng format (most common)
  let match = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (match) {
    return {
      lat: parseFloat(match[1]),
      lng: parseFloat(match[2]),
    };
  }

  // Pattern 2: !3dlat!4dlng format
  match = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (match) {
    return {
      lat: parseFloat(match[1]),
      lng: parseFloat(match[2]),
    };
  }

  // Pattern 3: /@lat,lng,zoom format
  match = url.match(/\/@(-?\d+\.\d+),(-?\d+\.\d+),(\d+\.?\d*)/);
  if (match) {
    return {
      lat: parseFloat(match[1]),
      lng: parseFloat(match[2]),
    };
  }

  // Pattern 4: place/.../@lat,lng format
  match = url.match(/place\/[^@]+@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (match) {
    return {
      lat: parseFloat(match[1]),
      lng: parseFloat(match[2]),
    };
  }

  return null;
}

// Helper function to use OpenStreetMap Nominatim (free, no API key needed)
async function geocodeWithNominatim(locationName) {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationName)}&limit=1`,
      {
        headers: {
          'User-Agent': 'Angkutan-System/1.0' // Required by Nominatim
        }
      }
    );
    const data = await response.json();
    
    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
      };
    }
  } catch (err) {
    console.error("Nominatim geocoding error:", err.message);
  }
  
  return null;
}

// Helper function to use Google Maps Geocoding API (if API key available)
async function geocodeWithGoogleMaps(locationName) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(locationName)}&key=${apiKey}`
    );
    const data = await response.json();
    
    if (data.status === "OK" && data.results && data.results.length > 0) {
      const location = data.results[0].geometry.location;
      return {
        lat: location.lat,
        lng: location.lng,
      };
    }
  } catch (err) {
    console.error("Geocoding API error:", err.message);
  }
  
  return null;
}

// GET /api/utils/resolve-location - Helpful error message
router.get("/resolve-location", (req, res) => {
  res.status(405).json({
    message: "Method not allowed. This endpoint requires POST request.",
    usage: "POST /api/utils/resolve-location",
    body: { input: "string (Google Maps URL, location name, or coordinates)" }
  });
});

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

    // 2. Try to parse Google Maps URL directly (no browser needed)
    if (input.includes("google.com/maps") || input.includes("maps.google.com")) {
      const coords = parseGoogleMapsUrl(input);
      if (coords) {
        return res.json({
          ...coords,
          method: "url-parse"
        });
      }
    }

    // 3. Try OpenStreetMap Nominatim (free, no API key needed)
    if (!input.startsWith("http")) {
      const nominatimResult = await geocodeWithNominatim(input);
      if (nominatimResult) {
        return res.json({
          ...nominatimResult,
          method: "nominatim"
        });
      }
    }

    // 4. Try Google Maps Geocoding API (if API key available)
    if (!input.startsWith("http")) {
      const geocodeResult = await geocodeWithGoogleMaps(input);
      if (geocodeResult) {
        return res.json({
          ...geocodeResult,
          method: "geocoding-api"
        });
      }
    }

    // 5. Fallback: Scrape from Google Maps using Playwright (DEV ONLY)
    // Di production (Render) kita TIDAK pakai Playwright karena browser tidak tersedia.
    // Kalau semua metode di atas gagal di production, kita minta user isi koordinat manual.
    const isProd = process.env.NODE_ENV === "production";
    const allowPlaywright =
      !isProd && process.env.ENABLE_PLAYWRIGHT_FALLBACK === "true";

    if (!allowPlaywright) {
      return res.status(200).json({
        lat: null,
        lng: null,
        method: "manual-required",
        message:
          "Tidak bisa menentukan koordinat dari alamat ini. Silakan masukkan koordinat (lat,lng) secara manual dari Google Maps.",
        tried_methods: ["direct-coords", "url-parse", "nominatim", "geocoding-api"],
      });
    }

    console.log("Using Playwright fallback for:", input);

    let browser;
    try {
      browser = await chromium.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"], // aman untuk dev container
      });
    } catch (playwrightError) {
      console.error("Playwright launch error:", playwrightError.message);
      return res.status(200).json({
        lat: null,
        lng: null,
        method: "manual-required",
        message:
          "Gagal membuka browser otomatis di environment ini. Silakan masukkan koordinat (lat,lng) secara manual.",
        tried_methods: ["direct-coords", "url-parse", "nominatim", "geocoding-api"],
      });
    }
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

    return res.status(404).json({ 
      message: "Coordinates not found. Please provide a valid Google Maps URL, location name, or coordinates.",
      suggestion: "If you have a Google Maps API key, set GOOGLE_MAPS_API_KEY in environment variables for better performance."
    });
  } catch (err) {
    console.error(`Scraping error: ${err.stack}`);
    
    // If Playwright fails due to missing browsers, provide helpful error
    if (err.message.includes("Executable doesn't exist") || err.message.includes("playwright")) {
      return res.status(500).json({ 
        message: "Browser automation not available. Please ensure Playwright browsers are installed.",
        error: "Run 'npx playwright install chromium' during deployment",
        fallback: "Consider using Google Maps Geocoding API instead (set GOOGLE_MAPS_API_KEY)"
      });
    }
    
    return res.status(500).json({ message: "Scraping failed", error: err.message });
  }
});

module.exports = router;
