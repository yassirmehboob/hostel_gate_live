import express from "express";
import AccessLog from "../models/accessLog.js"; // connected to LIVE Mongo
const router = express.Router();
// Keep each request short enough for cPanel/Passenger proxy timeouts. Access
// logs can contain images, so large batches can be expensive to upload/write.
const MAX_LOGS_PER_REQUEST = 30;

function isTransientMongoError(error) {
  return ["ETIMEDOUT", "ECONNRESET", "EPIPE"].includes(error?.code)
    || ["ETIMEDOUT", "ECONNRESET", "EPIPE"].includes(error?.cause?.code)
    || error?.name === "MongoNetworkError"
    || error?.errorResponse?.name === "MongoNetworkError"
    || error?.hasErrorLabel?.("ResetPool");
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
      .slice(0, MAX_LOGS_PER_REQUEST)
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

    await AccessLog.bulkWrite(ops, { ordered: false });

    return res.json({
      ok: true,
      syncedLogIds: clean.map(l => l.logId),
      remaining: Math.max(0, logs.length - MAX_LOGS_PER_REQUEST),
    });
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
