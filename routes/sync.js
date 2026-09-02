import express from "express";
import AccessLog from "../models/accessLog.js"; // connected to LIVE Mongo
const router = express.Router();
const BULK_BATCH_SIZE = 500;
const MAX_BULK_ATTEMPTS = 3;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientMongoError(error) {
  return ["ETIMEDOUT", "ECONNRESET", "EPIPE"].includes(error?.code)
    || ["ETIMEDOUT", "ECONNRESET", "EPIPE"].includes(error?.cause?.code)
    || error?.name === "MongoNetworkError"
    || error?.errorResponse?.name === "MongoNetworkError"
    || error?.hasErrorLabel?.("ResetPool");
}

async function writeBatchWithRetry(ops) {
  for (let attempt = 1; attempt <= MAX_BULK_ATTEMPTS; attempt += 1) {
    try {
      return await AccessLog.bulkWrite(ops, { ordered: false });
    } catch (error) {
      if (!isTransientMongoError(error) || attempt === MAX_BULK_ATTEMPTS) {
        throw error;
      }

      await delay(attempt * 500);
    }
  }
}

// Simple device auth (recommended)
function syncAuth(req, res, next) {
  const key = req.headers["x-sync-key"];

  if (!key || key != process.env.SYNC_KEY) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
}

router.post("/access-logs", syncAuth, async (req, res) => {
  try {
    const logs = req.body.logs;

    if (!Array.isArray(logs) || logs.length === 0) {
      return res.json({ ok: true, syncedLogIds: [] });
    }

  // OPTIONAL: validate required fields quickly
    const clean = logs
      .filter(l => l?.logId && l?.rollNo && l?.logDate && l?.direction)
      .map(l => ({
        ...l,
        syncStatus: undefined,
        syncedAt: undefined,
      }));

    if (clean.length === 0) {
      return res.status(400).json({ ok: false, message: "No valid access logs supplied" });
    }

    const ops = clean.map((l) => ({
      updateOne: {
        filter: { logId: l.logId },
        update: { $setOnInsert: l },
        upsert: true,
      },
    }));

    for (let start = 0; start < ops.length; start += BULK_BATCH_SIZE) {
      await writeBatchWithRetry(ops.slice(start, start + BULK_BATCH_SIZE));
    }

    return res.json({ ok: true, syncedLogIds: clean.map(l => l.logId) });
  } catch (error) {
    console.error("Access-log sync failed:", error?.message || error);

    if (isTransientMongoError(error)) {
      return res.status(503).json({
        ok: false,
        retryable: true,
        message: "Database temporarily unavailable; retry sync later",
      });
    }

    return res.status(500).json({
      ok: false,
      retryable: false,
      message: "Access-log sync failed",
    });
  }
});

export default router;
