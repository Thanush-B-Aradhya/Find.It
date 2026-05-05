const Session = require("../models/Session");
const {
  SESSION_COOKIE_NAME,
  hashSessionToken,
  parseCookies,
  serializeCookie
} = require("../lib/auth");

async function loadAuthSession(req, res, next) {
  try {
    req.authSession = null;
    req.authUser = null;

    const cookies = parseCookies(req.headers.cookie);
    const rawToken = cookies[SESSION_COOKIE_NAME];

    if (!rawToken) {
      next();
      return;
    }

    const session = await Session.findOne({
      tokenHash: hashSessionToken(rawToken),
      expiresAt: { $gt: new Date() }
    }).populate("userId");

    if (!session || !session.userId) {
      clearSessionCookie(res);
      next();
      return;
    }

    req.authSession = session;
    req.authUser = session.userId;
    next();
  } catch (error) {
    next(error);
  }
}

function requireAuth(req, res, next) {
  if (!req.authUser) {
    res.status(401).json({
      message: "Please sign in with your college Google account to continue."
    });
    return;
  }

  next();
}

function setSessionCookie(res, rawToken) {
  const isSecure = process.env.NODE_ENV === "production";
  const maxAgeSeconds = Math.floor(Number(process.env.SESSION_DAYS || 7) * 24 * 60 * 60);

  res.setHeader(
    "Set-Cookie",
    serializeCookie(SESSION_COOKIE_NAME, rawToken, {
      httpOnly: true,
      maxAge: maxAgeSeconds,
      path: "/",
      sameSite: "Lax",
      secure: isSecure
    })
  );
}

function clearSessionCookie(res) {
  const isSecure = process.env.NODE_ENV === "production";

  res.setHeader(
    "Set-Cookie",
    serializeCookie(SESSION_COOKIE_NAME, "", {
      httpOnly: true,
      maxAge: 0,
      path: "/",
      sameSite: "Lax",
      secure: isSecure
    })
  );
}

module.exports = {
  clearSessionCookie,
  loadAuthSession,
  requireAuth,
  setSessionCookie
};
