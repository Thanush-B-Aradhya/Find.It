const fs = require("fs");
const path = require("path");

const { normalizeUsn } = require("./auth");

const USERS_FILE_PATH = path.join(__dirname, "..", "data", "allowedUsers.json");
let cache = null;

function loadAllowedUsers() {
  if (cache) {
    return cache;
  }

  const raw = fs.readFileSync(USERS_FILE_PATH, "utf8");
  const parsed = JSON.parse(raw);
  const userMap = new Map();

  parsed.forEach((entry) => {
    const usn = normalizeUsn(entry.usn);
    const password = String(entry.password || "");

    if (!usn || !password) {
      return;
    }

    userMap.set(usn, password);
  });

  cache = userMap;
  return cache;
}

function isAllowedCredential(usnInput, passwordInput) {
  const usn = normalizeUsn(usnInput);
  const password = String(passwordInput || "");
  const users = loadAllowedUsers();

  if (!usn || !password) {
    return false;
  }

  return users.get(usn) === password;
}

function countAllowedUsers() {
  return loadAllowedUsers().size;
}

module.exports = {
  countAllowedUsers,
  isAllowedCredential,
  loadAllowedUsers
};
