const express = require("express");

const {
  buildSafeUser,
  createSessionToken,
  getAllowedEmailDomain,
  getSessionDurationMs,
  hashSessionToken
} = require("../lib/auth");
const { getGoogleClientId, isGoogleAuthConfigured, verifyGoogleCredential } = require("../lib/googleAuth");
const { clearSessionCookie, setSessionCookie } = require("../middleware/auth");
const Session = require("../models/Session");
const User = require("../models/User");

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
    allowedEmailDomain: getAllowedEmailDomain(),
    googleClientId: getGoogleClientId(),
    user: buildSafeUser(req.authUser)
  });
});

router.post("/google", async (req, res, next) => {
  try {
    if (!isTrustedOrigin(req)) {
      res.status(403).json({
        message: "That sign-in request did not come from this site."
      });
      return;
    }

    if (!isGoogleAuthConfigured()) {
      res.status(503).json({
        message: "Google sign-in is not configured yet. Add GOOGLE_CLIENT_ID on the server."
      });
      return;
    }

    const googleProfile = await verifyGoogleCredential(req.body.credential);
    let user = await User.findOne({ googleSub: googleProfile.googleSub });

    if (!user) {
      user = await User.findOne({ email: googleProfile.email });
    }

    if (user && user.googleSub && user.googleSub !== googleProfile.googleSub) {
      res.status(409).json({
        message: "This college email is already linked to a different Google account. Contact the admin."
      });
      return;
    }

    if (!user) {
      user = new User();
    }

    user.set({
      avatarUrl: googleProfile.avatarUrl,
      displayName: googleProfile.name,
      email: googleProfile.email,
      googleSub: googleProfile.googleSub,
      lastLoginAt: new Date()
    });

    await user.save();

    if (req.authSession) {
      await Session.deleteOne({ _id: req.authSession._id });
    }

    const rawToken = createSessionToken();
    await Session.create({
      expiresAt: new Date(Date.now() + getSessionDurationMs()),
      tokenHash: hashSessionToken(rawToken),
      userId: user._id
    });

    setSessionCookie(res, rawToken);

    res.json({
      message: "Signed in successfully.",
      user: buildSafeUser(user)
    });
  } catch (error) {
    if (error.status) {
      res.status(error.status).json({
        message: error.message
      });
      return;
    }

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
