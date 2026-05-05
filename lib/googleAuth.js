const { OAuth2Client } = require("google-auth-library");

const { getAllowedEmailDomain, isAllowedCollegeEmail, normalizeEmail } = require("./auth");

let googleClient = null;

function createGoogleAuthError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function getGoogleClientId() {
  return String(process.env.GOOGLE_CLIENT_ID || "").trim();
}

function isGoogleAuthConfigured() {
  const clientId = getGoogleClientId();
  return Boolean(clientId) && clientId !== "your-google-client-id.apps.googleusercontent.com";
}

function getGoogleClient() {
  if (!googleClient) {
    googleClient = new OAuth2Client();
  }

  return googleClient;
}

async function verifyGoogleCredential(credential) {
  if (!isGoogleAuthConfigured()) {
    throw createGoogleAuthError("Google sign-in is not configured yet.", 503);
  }

  const rawCredential = String(credential || "").trim();

  if (!rawCredential) {
    throw createGoogleAuthError("Google sign-in did not return a credential.", 400);
  }

  const ticket = await getGoogleClient().verifyIdToken({
    audience: getGoogleClientId(),
    idToken: rawCredential
  });
  const payload = ticket.getPayload();

  if (!payload) {
    throw createGoogleAuthError("Could not read the Google account details.", 401);
  }

  const email = normalizeEmail(payload.email);
  const hostedDomain = normalizeEmail(payload.hd);
  const allowedDomain = getAllowedEmailDomain();

  if (!payload.sub) {
    throw createGoogleAuthError("Google sign-in did not include a stable account id.", 401);
  }

  if (payload.email_verified !== true) {
    throw createGoogleAuthError("Only verified Google accounts can sign in.", 403);
  }

  if (!isAllowedCollegeEmail(email)) {
    throw createGoogleAuthError(`Only @${allowedDomain} Google accounts can sign in.`, 403);
  }

  if (!hostedDomain || hostedDomain !== allowedDomain) {
    throw createGoogleAuthError(
      `Use your managed @${allowedDomain} Google Workspace account to sign in.`,
      403
    );
  }

  return {
    avatarUrl: String(payload.picture || ""),
    email,
    googleSub: String(payload.sub),
    hostedDomain,
    name: String(payload.name || email.split("@")[0] || "").trim()
  };
}

module.exports = {
  getGoogleClientId,
  isGoogleAuthConfigured,
  verifyGoogleCredential
};
