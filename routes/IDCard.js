import express from "express";
import QRCode from "qrcode";
import sharp from "sharp";
import { createCanvas, loadImage } from "canvas";
import fs from "fs";
import path from "path";
import Student from "../models/students.js";
import { format } from "date-fns";
import { TZDate } from "@date-fns/tz";

const router = express.Router();

const CARD_W = 638;
const CARD_H = 1013;
const LOCAL_LOGO_PATH = path.resolve("./assets/uos-logo.png");

function safeText(v, fallback = "-") {
  if (v === null || v === undefined) return fallback;
  const s = String(v).trim();
  return s.length ? s : fallback;
}

function wrapText(ctx, text, maxWidth) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = "";

  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth) line = test;
    else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

router.post("/M/id-card/vertical.jpg", async (req, res) => {
  try {
    const { rollNo, qrPayload, logoUrl } = req.body;

    if (!rollNo) return res.status(400).json({ error: "rollNo is required in request body" });

    const std = await Student.findOne({ rollNo }).lean(); // lean() helps with Buffer handling
    if (!std) return res.status(404).json({ error: `${rollNo} is not found.` });

    if (std.active == 0) return res.status(400).json({ error: "allotment is disabled." });

    const name = safeText(`${safeText(std.firstName, "")} ${safeText(std.lastName, "")}`.trim(), "-");
    const rollNumber = safeText(std.rollNo, rollNo);
    const hostelName = safeText(std.hostelName);
    const blockNo = safeText(std.blockName);
    const roomNo = safeText(std.roomNo);
    const discipline = safeText(std.programTitle);
    const fname = safeText(std.fName);
    const validaty = std.stayTo;
    const year = safeText(std.year);
    const hostelForName = safeText(std.hostelForName);

    const timeZone = "Asia/Karachi";

    if (!std?.stayTo) {
      return res.status(400).json({ error: "Validity date not found." });
    }

    const nowPK = new TZDate(new Date(), timeZone);
    const expiryPK = new TZDate(std.stayTo, timeZone);

    if (nowPK > expiryPK) {
        return res.status(400).json({error: "ID card validity has expired."});
      }

    const formattedStayTo = std?.stayTo? format(std.stayTo, "MMMM, yyyy"): "-";


    const payload = safeText(qrPayload, `${rollNumber}~${year}~${formattedStayTo}~dhid`);

    const qrPngBuffer = await QRCode.toBuffer(payload, {
      type: "png",
      errorCorrectionLevel: "M",
      margin: 1,
      width: 512,
    });

    // ---- 2) Canvas ----
    const canvas = createCanvas(CARD_W, CARD_H);
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, CARD_W, CARD_H);

    // Header
    if(hostelForName == "BOYS HOSTEL")
    ctx.fillStyle = "#0b3d91";
    else if(hostelForName == "GIRLS HOSTEL")
    ctx.fillStyle = "#d16ba5";

    ctx.fillRect(0, 0, CARD_W, 180);

    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.font = "bold 36px Arial";
    ctx.fillText("University of Sindh", CARD_W / 2, 55);

    ctx.font = "bold 22px Arial";
    ctx.fillText("HOSTEL IDENTITY CARD", CARD_W / 2, 105);

    // ---- 3) Logo ----
    // const logoCenterX = CARD_W / 2;
    // const logoCenterY = 150;
    const logoSize = 95;
    const logoPaddingX = 18;
    const logoPaddingY = 35; // lower
    const logoCenterX = logoPaddingX + logoSize / 2;
    const logoCenterY = logoPaddingY + logoSize / 2;


    async function drawLogoFromImage(src) {
      const logoImg = await loadImage(src);

      ctx.save();
      ctx.beginPath();
      ctx.arc(logoCenterX, logoCenterY, logoSize / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();

      const boxX = logoCenterX - logoSize / 2;
      const boxY = logoCenterY - logoSize / 2;

      const imgAR = logoImg.width / logoImg.height;
      const boxAR = 1;

      let sx = 0, sy = 0, sw = logoImg.width, sh = logoImg.height;
      if (imgAR > boxAR) {
        sw = logoImg.height * boxAR;
        sx = (logoImg.width - sw) / 2;
      } else {
        sh = logoImg.width / boxAR;
        sy = (logoImg.height - sh) / 2;
      }

      ctx.drawImage(logoImg, sx, sy, sw, sh, boxX, boxY, logoSize, logoSize);
      ctx.restore();

      // ctx.strokeStyle = "#ffffff";
      // ctx.lineWidth = 4;
      // ctx.beginPath();
      // ctx.arc(logoCenterX, logoCenterY, logoSize / 2, 0, Math.PI * 2);
      // ctx.stroke();
    }

    let drewLogo = false;
    try {
      if (logoUrl) {
        await drawLogoFromImage(logoUrl);
        drewLogo = true;
      } else if (fs.existsSync(LOCAL_LOGO_PATH)) {
        await drawLogoFromImage(LOCAL_LOGO_PATH);
        drewLogo = true;
      }
    } catch {
      drewLogo = false;
    }

    if (!drewLogo) {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(logoCenterX, logoCenterY, logoSize / 2, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 28px Arial";
      ctx.fillText("US", logoCenterX, logoCenterY);
    }

    // ---- 4) Photo (Mongo Buffer -> Sharp -> Canvas) ----
    const photoTop = 190;
    const photoSize = 250;
    const photoLeft = Math.floor((CARD_W - photoSize) / 2);

    ctx.fillStyle = "#e6f0ff";
    ctx.fillRect(photoLeft, photoTop, photoSize, photoSize);
    ctx.strokeStyle = "#c8c8c8";
    ctx.lineWidth = 3;
    ctx.strokeRect(photoLeft, photoTop, photoSize, photoSize);

    async function drawCoverSquare(img) {
      const imgAR = img.width / img.height;
      const boxAR = 1;

      let sx = 0, sy = 0, sw = img.width, sh = img.height;
      if (imgAR > boxAR) {
        sw = img.height * boxAR;
        sx = (img.width - sw) / 2;
      } else {
        sh = img.width / boxAR;
        sy = (img.height - sh) / 2;
      }

      ctx.drawImage(img, sx, sy, sw, sh, photoLeft, photoTop, photoSize, photoSize);
    }
let drewPortrait = false;

try {
  // 1) Get raw image bytes regardless of how it's stored
  let rawBytes = null;
  let contentType = null;

  // Format A: schema { image: { data: Buffer, contentType: String } }
  if (std?.image?.data) {
    rawBytes = std.image.data;
    contentType = std.image.contentType || null;
  }
  // Format B: stored directly as Buffer / BSON Binary
  else if (std?.image) {
    rawBytes = std.image;
  }

  // 2) Convert to real Buffer
  let rawBuffer = null;

  if (rawBytes) {
    if (Buffer.isBuffer(rawBytes)) {
      rawBuffer = rawBytes;
    } else if (rawBytes.buffer) {
      // BSON Binary object -> Buffer
      rawBuffer = Buffer.from(rawBytes.buffer);
    } else {
      rawBuffer = Buffer.from(rawBytes);
    }
  }

  if (rawBuffer && rawBuffer.length) {
    // 3) Normalize with sharp (handles jpeg/png, EXIF rotation, etc.)
    const normalized = await sharp(rawBuffer)
      .rotate()
      .resize(600, 600, { fit: "cover" })
      .png()
      .toBuffer();

    // 4) Draw on canvas
    const portraitImg = await loadImage(normalized);
    await drawCoverSquare(portraitImg);
    drewPortrait = true;
  }
} catch (e) {
  console.error("Portrait load failed:", e);
  drewPortrait = false;
}


    if (!drewPortrait) {
      // Placeholder
      ctx.save();
      ctx.translate(photoLeft, photoTop);

      ctx.fillStyle = "#ffe0bd";
      ctx.beginPath();
      ctx.ellipse(photoSize * 0.5, photoSize * 0.32, photoSize * 0.20, photoSize * 0.20, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#1e5aaa";
      ctx.fillRect(photoSize * 0.30, photoSize * 0.52, photoSize * 0.40, photoSize * 0.33);

      ctx.restore();
    }

    // ---- 5) Fields (Discipline wraps to 2 lines) ----
    const infoStartY = photoTop + photoSize + 40;
    const leftMargin = 80;
    let y = infoStartY;

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";

function drawField(label, value, opts = {}) {
  const {
    maxLines = 1,
    valueMaxWidth = 280,
    lineHeight = 25,
    gapAfter = 12,
    labelColor = "#000000",
    valueColor = "#000000",
  } = opts;

  // label
  ctx.fillStyle = labelColor;
  ctx.font = "bold 22px Arial";
  ctx.fillText(label, leftMargin, y);

  // value
  ctx.fillStyle = valueColor;
  ctx.font = "22px Arial";
  const v = safeText(value);
  const valueX = leftMargin + 200;

  const lines = wrapText(ctx, v, valueMaxWidth).slice(0, maxLines);
  for (let i = 0; i < lines.length; i++) ctx.fillText(lines[i], valueX, y + i * lineHeight);

  y += Math.max(1, lines.length) * lineHeight + gapAfter;
}


    
    drawField("Name:", name, { valueMaxWidth: 300 });
    drawField("Father's Name:", fname, { valueMaxWidth: 300 });
    drawField("Hostel:", hostelName, { valueMaxWidth: 300 });
    drawField("Block No:", blockNo, { valueMaxWidth: 300 });
    drawField("Room No:", roomNo, { valueMaxWidth: 300 });
    drawField("Roll No:", rollNumber, { valueMaxWidth: 300 });
    drawField("Discipline:", discipline, { maxLines: 2, valueMaxWidth: 280 });
    drawField("Valid Upto:", formattedStayTo, { valueMaxWidth: 300,labelColor: "#d00000", valueColor: "#d00000" });
    

    // ---- 6) QR ----
    const qrImg = await loadImage(qrPngBuffer);
    const qrSize = 150;
    const qrX = Math.floor((CARD_W - qrSize) / 2);
    const qrY = CARD_H - qrSize - 80;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(qrX - 10, qrY - 10, qrSize + 20, qrSize + 20);
    ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

    ctx.fillStyle = "#3c3c3c";
    ctx.font = "16px Arial";
    ctx.textAlign = "center";
    ctx.fillText("Scan at Hostel Gate", CARD_W / 2, qrY + qrSize + 30);

    // Footer
    ctx.strokeStyle = "#c8c8c8";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(50, CARD_H - 40);
    ctx.lineTo(CARD_W - 50, CARD_H - 40);
    ctx.stroke();

    ctx.fillStyle = "#646464";
    ctx.font = "16px Arial";
    ctx.fillText("Information Technology Services Centre", CARD_W / 2, CARD_H - 18);

    // ---- 7) Output ----
    const pngBuffer = canvas.toBuffer("image/png");
    const jpgBuffer = await sharp(pngBuffer).jpeg({ quality: 95 }).toBuffer();

    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Content-Disposition", `inline; filename="${safeText(rollNumber, "student")}-uos-id.jpg"`);
    return res.send(jpgBuffer);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to generate vertical ID card" });
  }
});

export default router;
