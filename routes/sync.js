import express from "express";
import AccessLog from "../models/accessLog.js"; // connected to LIVE Mongo
const router = express.Router();

// Simple device auth (recommended)
function syncAuth(req, res, next) {
  const key = req.headers["x-sync-key"];

  if (!key || key != process.env.SYNC_KEY) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
}

router.post("/access-logs", syncAuth, async (req, res) => {
  const logs = req.body.logs;

  if (!Array.isArray(logs) || logs.length === 0) {
    return res.json({ ok: true, syncedLogIds: [] });
  }

  // OPTIONAL: validate required fields quickly
  const clean = logs
    .filter(l => l?.logId && l?.rollNo && l?.logDate && l?.direction)
    .map(l => ({
      ...l,
      syncStatus: undefined, // don't store local sync flags in live DB if you don't want
      syncedAt: undefined,
    }));

  const ops = clean.map((l) => ({
    updateOne: {
      filter: { logId: l.logId },
      update: { $setOnInsert: l },
      upsert: true,
    },
  }));

  // ordered:false => continues even if some are duplicates
  await AccessLog.bulkWrite(ops, { ordered: false });

  // Return ack list so offline can mark these as SYNCED
  res.json({ ok: true, syncedLogIds: clean.map(l => l.logId) });
});

export default router;
