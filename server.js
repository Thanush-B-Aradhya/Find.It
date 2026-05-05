require("dotenv").config();

const path = require("path");
const express = require("express");

const connectToDatabase = require("./config/db");
const { countAllowedUsers } = require("./lib/allowedUsers");
const { isPlaceholderSessionSecret } = require("./lib/auth");
const { loadAuthSession } = require("./middleware/auth");
const authRoutes = require("./routes/auth");
const itemRoutes = require("./routes/items");

const app = express();
const PORT = Number(process.env.PORT) || 5000;
const configuredMongoUri = String(process.env.MONGODB_URI || "").trim();
const MONGODB_URI =
  configuredMongoUri ||
  (process.env.NODE_ENV === "production" ? "" : "mongodb://127.0.0.1:27017/findit");
let startupPromise = null;
let startupError = null;

function validateRuntimeConfig() {
  const issues = [];

  if (!MONGODB_URI.trim()) {
    issues.push("MONGODB_URI must be configured.");
  }

  if (isPlaceholderSessionSecret()) {
    issues.push("SESSION_SECRET must be replaced with a long random secret.");
  }

  if (countAllowedUsers() === 0) {
    issues.push("No allowed users found. Check data/allowedUsers.json.");
  }

  if (issues.length > 0) {
    throw new Error(`FindIt configuration error:\n- ${issues.join("\n- ")}`);
  }
}

app.use(express.json({ limit: "10mb" }));

app.use(async (req, res, next) => {
  if (req.path === "/api/health") {
    next();
    return;
  }

  try {
    await ensureServerReady();
    next();
  } catch (error) {
    startupError = error;
    next(error);
  }
});
app.use(loadAuthSession);

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
  if (startupError) {
    res.status(500).json({
      message: "Startup failed.",
      details: startupError.message || "Unknown startup error."
    });
    return;
  }

  res.json({
    message: "FindIt API is running.",
    allowedUsers: countAllowedUsers(),
    timestamp: new Date().toISOString()
  });
});

app.use("/api/auth", authRoutes);
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
    })();
  }

  startupPromise = startupPromise.catch((error) => {
    startupError = error;
    throw error;
  });

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
