const express = require("express");
const crypto = require("crypto");

const { parseCookies, serializeCookie } = require("../lib/auth");
const Item = require("../models/Item");

const router = express.Router();
const OWNER_COOKIE_NAME = "findit_owner";
const OWNER_COOKIE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

const SORT_OPTIONS = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 }
};

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildPayload(body) {
  return {
    type: body.type,
    photoData: body.photoData || "",
    name: body.name?.trim(),
    category: body.category || "other",
    description: body.description?.trim(),
    location: body.location?.trim() || "",
    date: body.date ? body.date : null,
    contactName: body.contactName?.trim() || "",
    phone: body.phone?.trim() || "",
    email: body.email?.trim() || "",
    reward: body.reward?.trim() || ""
  };
}

function hashOwnerToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

function getOwnerTokenFromRequest(req) {
  const cookies = parseCookies(req.headers.cookie);
  const token = String(cookies[OWNER_COOKIE_NAME] || "").trim();
  return token || null;
}

function setOwnerCookie(res, token) {
  const isSecure = process.env.NODE_ENV === "production";

  res.setHeader(
    "Set-Cookie",
    serializeCookie(OWNER_COOKIE_NAME, token, {
      httpOnly: true,
      maxAge: OWNER_COOKIE_MAX_AGE_SECONDS,
      path: "/",
      sameSite: "Lax",
      secure: isSecure
    })
  );
}

function ensureOwnerToken(req, res) {
  const existingToken = getOwnerTokenFromRequest(req);

  if (existingToken) {
    return existingToken;
  }

  const createdToken = crypto.randomBytes(32).toString("hex");
  setOwnerCookie(res, createdToken);
  return createdToken;
}

function isOwner(item, ownerToken) {
  if (!item?.ownerTokenHash || !ownerToken) {
    return false;
  }

  return item.ownerTokenHash === hashOwnerToken(ownerToken);
}

function sanitizeItem(item) {
  if (!item) {
    return item;
  }

  const source = typeof item.toObject === "function" ? item.toObject() : item;
  const { ownerTokenHash, ...safeItem } = source;
  return safeItem;
}

function decorateItem(item, ownerToken) {
  return {
    ...sanitizeItem(item),
    isOwner: isOwner(item, ownerToken)
  };
}

function requireOwner(item, ownerToken, res) {
  if (!item) {
    res.status(404).json({ message: "Item not found." });
    return false;
  }

  if (!item.ownerTokenHash) {
    res.status(403).json({
      message: "This item was posted before ownership protection was enabled and cannot be modified."
    });
    return false;
  }

  if (!isOwner(item, ownerToken)) {
    res.status(403).json({
      message: "Only the person who posted this item can edit, resolve, or delete it from their original browser."
    });
    return false;
  }

  return true;
}

router.get("/stats", async (req, res, next) => {
  try {
    const [lost, found, resolved, total] = await Promise.all([
      Item.countDocuments({ type: "lost", status: "open" }),
      Item.countDocuments({ type: "found", status: "open" }),
      Item.countDocuments({ status: "resolved" }),
      Item.countDocuments()
    ]);

    res.json({
      stats: {
        lost,
        found,
        resolved,
        total
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get("/", async (req, res, next) => {
  try {
    const ownerToken = getOwnerTokenFromRequest(req);
    const filter = {};
    const search = req.query.search?.trim();
    const sort = SORT_OPTIONS[req.query.sort] || SORT_OPTIONS.newest;

    if (req.query.type && ["lost", "found"].includes(req.query.type)) {
      filter.type = req.query.type;
    }

    if (req.query.status && ["open", "resolved"].includes(req.query.status)) {
      filter.status = req.query.status;
    }

    if (req.query.category && req.query.category !== "all") {
      filter.category = req.query.category;
    }

    if (search) {
      const regex = new RegExp(escapeRegex(search), "i");
      filter.$or = [
        { name: regex },
        { description: regex },
        { location: regex }
      ];
    }

    const items = await Item.find(filter).sort(sort).lean();

    res.json({
      items: items.map((item) => decorateItem(item, ownerToken))
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const ownerToken = getOwnerTokenFromRequest(req);
    const item = await Item.findById(req.params.id).lean();

    if (!item) {
      res.status(404).json({ message: "Item not found." });
      return;
    }

    res.json({
      item: decorateItem(item, ownerToken)
    });
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const ownerToken = ensureOwnerToken(req, res);
    const payload = buildPayload(req.body);
    payload.ownerEmail = payload.email || "";
    payload.ownerTokenHash = hashOwnerToken(ownerToken);

    const item = await Item.create(payload);
    res.status(201).json({ item: decorateItem(item, ownerToken) });
  } catch (error) {
    next(error);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const ownerToken = getOwnerTokenFromRequest(req);
    const item = await Item.findById(req.params.id);

    if (!requireOwner(item, ownerToken, res)) {
      return;
    }

    const payload = buildPayload(req.body);
    item.set({
      ...payload,
      email: payload.email || item.email || "",
      contactName: payload.contactName || item.contactName || "",
      ownerEmail: item.ownerEmail || payload.email || item.email || "",
      ownerId: item.ownerId || null,
      ownerTokenHash: item.ownerTokenHash
    });

    await item.save();

    res.json({ item: decorateItem(item, ownerToken) });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/resolve", async (req, res, next) => {
  try {
    const ownerToken = getOwnerTokenFromRequest(req);
    const item = await Item.findById(req.params.id);

    if (!requireOwner(item, ownerToken, res)) {
      return;
    }

    item.status = "resolved";
    await item.save();

    res.json({ item: decorateItem(item, ownerToken) });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const ownerToken = getOwnerTokenFromRequest(req);
    const item = await Item.findById(req.params.id);

    if (!requireOwner(item, ownerToken, res)) {
      return;
    }

    await Item.deleteOne({ _id: item._id });

    res.json({ message: "Item deleted." });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
