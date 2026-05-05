const express = require("express");

const {
  buildSafeUser,
  createSessionToken,
  getSessionDurationMs,
  hashSessionToken,
  normalizeUsn
} = require("../lib/auth");
const { countAllowedUsers, isAllowedCredential } = require("../lib/allowedUsers");
const { clearSessionCookie, setSessionCookie } = require("../middleware/auth");
const Session = require("../models/Session");

const router = express.Router();

function isTrustedOrigin(req) {
  const origin = req.get("origin");

  if (!origin) {
    return true;
  }

  try {
    return new URL(origin).host === req.get("host");
  } catch (error) {
    return false;
  }
}

router.get("/session", async (req, res) => {
  res.json({
    allowedUsers: countAllowedUsers(),
    user: buildSafeUser(req.authUser)
  });
});

router.post("/login", async (req, res, next) => {
  try {
    if (!isTrustedOrigin(req)) {
      res.status(403).json({
        message: "That sign-in request did not come from this site."
      });
      return;
    }

    const usn = normalizeUsn(req.body?.usn);
    const password = String(req.body?.password || "");

    if (!usn || !password) {
      res.status(400).json({
        message: "Please enter both USN and password."
      });
      return;
    }

    if (!isAllowedCredential(usn, password)) {
      res.status(401).json({
        message: "Invalid USN or password. Only listed USNs can log in."
      });
      return;
    }

    if (req.authSession) {
      await Session.deleteOne({ _id: req.authSession._id });
    }

    const rawToken = createSessionToken();
    await Session.create({
      expiresAt: new Date(Date.now() + getSessionDurationMs()),
      tokenHash: hashSessionToken(rawToken),
      usn
    });

    setSessionCookie(res, rawToken);

    res.json({
      message: "Signed in successfully.",
      user: buildSafeUser({ usn })
    });
  } catch (error) {
    next(error);
  }
});

router.post("/logout", async (req, res, next) => {
  try {
    if (req.authSession) {
      await Session.deleteOne({ _id: req.authSession._id });
    }

    clearSessionCookie(res);

    res.json({
      message: "Signed out."
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
