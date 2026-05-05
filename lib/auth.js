const crypto = require("crypto");

const SESSION_COOKIE_NAME = "findit_session";

function normalizeUsn(value) {
  return String(value || "").trim().toUpperCase();
}

function isDevelopmentEnvironment() {
  return String(process.env.NODE_ENV || "development").trim().toLowerCase() !== "production";
}

function isPlaceholderSessionSecret() {
  const sessionSecret = String(process.env.SESSION_SECRET || "").trim();

  return (
    !sessionSecret ||
    sessionSecret === "replace-this-with-a-long-random-secret" ||
    sessionSecret === "findit-dev-session-secret"
  );
}

function getSessionSecret() {
  return process.env.SESSION_SECRET || "findit-dev-session-secret";
}

function getSessionDurationMs() {
  const rawDays = Number(process.env.SESSION_DAYS || 7);
  const days = Number.isFinite(rawDays) && rawDays > 0 ? rawDays : 7;
  return days * 24 * 60 * 60 * 1000;
}

function createSessionToken() {
  return crypto.randomBytes(32).toString("hex");
}

function hashValue(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function hashSessionToken(token) {
  return hashValue(token);
}

function parseCookies(headerValue) {
  const cookies = {};

  String(headerValue || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .forEach((part) => {
      const separatorIndex = part.indexOf("=");

      if (separatorIndex === -1) {
        return;
      }

      const name = part.slice(0, separatorIndex).trim();
      const value = part.slice(separatorIndex + 1).trim();
      cookies[name] = decodeURIComponent(value);
    });

  return cookies;
}

function serializeCookie(name, value, options = {}) {
  const segments = [`${name}=${encodeURIComponent(value)}`];

  if (options.maxAge !== undefined) {
    segments.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge))}`);
  }

  if (options.path) {
    segments.push(`Path=${options.path}`);
  }

  if (options.httpOnly) {
    segments.push("HttpOnly");
  }

  if (options.sameSite) {
    segments.push(`SameSite=${options.sameSite}`);
  }

  if (options.secure) {
    segments.push("Secure");
  }

  return segments.join("; ");
}

function buildSafeUser(user) {
  if (!user) {
    return null;
  }

  const normalizedUsn = normalizeUsn(user.usn);

  if (normalizedUsn) {
    return {
      usn: normalizedUsn
    };
  }

  return {
    id: String(user._id),
    email: user.email,
    displayName: user.displayName || "",
    avatarUrl: user.avatarUrl || ""
  };
}

module.exports = {
  SESSION_COOKIE_NAME,
  buildSafeUser,
  createSessionToken,
  getSessionDurationMs,
  hashSessionToken,
  isDevelopmentEnvironment,
  isPlaceholderSessionSecret,
  normalizeUsn,
  parseCookies,
  serializeCookie
};
