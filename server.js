require("dotenv").config();

const path = require("path");
const express = require("express");

const connectToDatabase = require("./config/db");
const Item = require("./models/Item");
const itemRoutes = require("./routes/items");
const { seedItemsIfNeeded } = require("./data/seedItems");

const app = express();
const PORT = Number(process.env.PORT) || 5000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/findit";
const SHOULD_SEED_SAMPLE_DATA = String(process.env.SEED_SAMPLE_DATA || "true").trim().toLowerCase() !== "false";
let startupPromise = null;

function validateRuntimeConfig() {
  const issues = [];

  if (!MONGODB_URI.trim()) {
    issues.push("MONGODB_URI must be configured.");
  }

  if (issues.length > 0) {
    throw new Error(`FindIt configuration error:\n- ${issues.join("\n- ")}`);
  }
}

app.use(express.json({ limit: "10mb" }));

app.use(async (req, res, next) => {
  try {
    await ensureServerReady();
    next();
  } catch (error) {
    next(error);
  }
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/index.html", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/styles.css", (req, res) => {
  res.sendFile(path.join(__dirname, "styles.css"));
});

app.get("/app.js", (req, res) => {
  res.sendFile(path.join(__dirname, "app.js"));
});

app.get("/api/health", (req, res) => {
  res.json({
    message: "FindIt API is running.",
    timestamp: new Date().toISOString()
  });
});

app.use("/api/items", itemRoutes);

app.use((req, res) => {
  if (req.path.startsWith("/api/")) {
    res.status(404).json({ message: "API route not found." });
    return;
  }

  res.status(404).send("Page not found.");
});

app.use((error, req, res, next) => {
  console.error(error);

  if (error.name === "CastError") {
    res.status(400).json({ message: "Invalid item id." });
    return;
  }

  if (error.name === "ValidationError") {
    const message = Object.values(error.errors)
      .map((entry) => entry.message)
      .join(" ");

    res.status(400).json({ message });
    return;
  }

  if (error.status) {
    res.status(error.status).json({
      message: error.message || "Request failed."
    });
    return;
  }

  res.status(500).json({ message: "Something went wrong on the server." });
});

function ensureServerReady() {
  if (!startupPromise) {
    startupPromise = (async () => {
      validateRuntimeConfig();
      await connectToDatabase(MONGODB_URI);

      if (SHOULD_SEED_SAMPLE_DATA) {
        await seedItemsIfNeeded(Item);
      }
    })();
  }

  return startupPromise;
}

if (require.main === module) {
  ensureServerReady()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`FindIt server running on http://localhost:${PORT}`);
      });
    })
    .catch((error) => {
      console.error("Failed to start FindIt:", error);
      process.exit(1);
    });
}

module.exports = app;
