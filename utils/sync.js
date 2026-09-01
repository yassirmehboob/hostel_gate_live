import cron from "node-cron";
import axios from "axios";
import AccessLog from "../models/accessLog.js"; // OFFLINE Mongo model
import dotenv from 'dotenv';

dotenv.config();

const SYNC_URL = process.env.SYNC_URL; // e.g. https://yourserver.com/sync/access-logs
const SYNC_KEY = process.env.SYNC_KEY; // same key on online server
const BATCH_SIZE = 200;
let running = false;

// console.log("SYNC_URL raw =", process.env.SYNC_URL);
// console.log("SYNC_URL JSON =", JSON.stringify(process.env.SYNC_URL));

async function syncAccessLogsOnce() {
  try {
    // Pick only unsynced logs
    const logs = await AccessLog.find({
      syncStatus: { $in: ["PENDING", "FAILED"] },
    })
      .sort({ logDate: 1 })
      .limit(BATCH_SIZE)
      .lean();

    if (logs.length === 0) return;

    // Send to online API
    const resp = await axios.post(
      SYNC_URL,
      { logs },
      {
        timeout: 15000,
        headers: {
          "Content-Type": "application/json",
          "x-sync-key": SYNC_KEY,
        },
      }
    );

    const syncedLogIds = resp.data?.syncedLogIds || [];

    if (syncedLogIds.length > 0) {
      // Mark only ACKed logs as SYNCED
      await AccessLog.updateMany(
        { logId: { $in: syncedLogIds } },
        { $set: { syncStatus: "SYNCED", syncedAt: new Date() } }
      );
    }

    console.log(`✅ Synced ${syncedLogIds.length} logs`);
  } catch (err) {
    // Mark the attempted batch as FAILED (optional)
    console.error("❌ Sync error:", err.message);

    // You can avoid marking FAILED if you want, but it's useful for tracking
    // (Only do if you want retry visibility)
  }
}

cron.schedule("0 */2 * * *", async () => {
  if (running) {
    console.log("Previous job still running, skipping...");
    return;
  }

  try {
    running = true;
    await syncAccessLogsOnce();
  } catch (err) {
    console.error(err);
  } finally {
    running = false;
  }
});

// Run every 2 minutes
// cron.schedule("*/2 * * * *", syncAccessLogsOnce);

// Run immediately on startup
// syncAccessLogsOnce();
