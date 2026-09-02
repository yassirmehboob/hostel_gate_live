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

function roundedRect(ctx, x, y, width, height, radius, fill, stroke) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
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
    const shift = safeText(std.shiftName);
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

    const primaryColor = hostelForName === "GIRLS HOSTEL" ? "#9d2f67" : "#123f73";
    const accentColor = hostelForName === "GIRLS HOSTEL" ? "#dca0bd" : "#5ba4d9";
    const inkColor = "#172033";
    const mutedColor = "#667085";
    const borderColor = "#d8dee8";

    // Header
    ctx.fillStyle = primaryColor;
    ctx.fillRect(0, 0, CARD_W, 165);
    ctx.fillStyle = accentColor;
    ctx.fillRect(0, 157, CARD_W, 8);

    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.font = "bold 34px Arial";
    ctx.fillText("UNIVERSITY OF SINDH", CARD_W / 2 + 45, 52);

    ctx.font = "20px Arial";
    ctx.fillText("HOSTEL IDENTITY CARD", CARD_W / 2 + 45, 91);

    ctx.font = "bold 16px Arial";
    ctx.fillText(hostelForName, CARD_W / 2 + 45, 124);

    // ---- 3) Logo ----
    // const logoCenterX = CARD_W / 2;
    // const logoCenterY = 150;
    const logoSize = 95;
    const logoPaddingX = 20;
    const logoPaddingY = 28;
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
    const photoTop = 200;
    const photoSize = 220;
    const photoLeft = 42;

    ctx.lineWidth = 2;
    roundedRect(ctx, photoLeft - 7, photoTop - 7, photoSize + 14, photoSize + 14, 14, "#ffffff", borderColor);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(photoLeft, photoTop, photoSize, photoSize, 9);
    ctx.clip();
    ctx.fillStyle = "#eef3f8";
    ctx.fillRect(photoLeft, photoTop, photoSize, photoSize);

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

    ctx.restore();

    // Student identity
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = mutedColor;
    ctx.font = "bold 15px Arial";
    ctx.fillText("STUDENT", 294, 215);

    ctx.fillStyle = inkColor;
    ctx.font = "bold 27px Arial";
    const nameLines = wrapText(ctx, name, 300).slice(0, 2);
    nameLines.forEach((line, index) => ctx.fillText(line, 294, 250 + index * 32));

    ctx.fillStyle = primaryColor;
    ctx.font = "bold 21px Arial";
    ctx.fillText(rollNumber, 294, 327);

    ctx.fillStyle = mutedColor;
    ctx.font = "16px Arial";
    wrapText(ctx, discipline, 295).slice(0, 2).forEach((line, index) => {
      ctx.fillText(line, 294, 361 + index * 22);
    });

    roundedRect(ctx, 294, 394, 270, 38, 19, primaryColor);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 15px Arial";
    ctx.textAlign = "center";
    ctx.fillText(`VALID UNTIL  ${formattedStayTo.toUpperCase()}`, 429, 419);

    // Details panel
    roundedRect(ctx, 34, 465, 570, 286, 16, "#f8fafc", borderColor);
    ctx.textAlign = "left";

    function drawDetail(label, value, x, y, maxWidth = 235, maxLines = 1) {
      ctx.fillStyle = mutedColor;
      ctx.font = "bold 13px Arial";
      ctx.fillText(label.toUpperCase(), x, y);
      ctx.fillStyle = inkColor;
      ctx.font = "19px Arial";
      wrapText(ctx, safeText(value), maxWidth).slice(0, maxLines).forEach((line, index) => {
        ctx.fillText(line, x, y + 27 + index * 21);
      });
    }

    drawDetail("Father's Name", fname, 60, 500, 245, 2);
    drawDetail("Hostel", hostelName, 335, 500, 230, 2);
    drawDetail("Block", blockNo, 60, 585);
    drawDetail("Room", roomNo, 335, 585);
    drawDetail("Academic Year", `${year} (${shift})`, 60, 665);
    drawDetail("Card Type", "Resident Student", 335, 665);
    

    // ---- 6) QR ----
    const qrImg = await loadImage(qrPngBuffer);
    const qrSize = 170;
    const qrX = 38;
    const qrY = 780;

    roundedRect(ctx, qrX - 10, qrY - 10, qrSize + 20, qrSize + 20, 10, "#ffffff", borderColor);
    ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

    ctx.fillStyle = inkColor;
    ctx.font = "bold 20px Arial";
    ctx.textAlign = "left";
    ctx.fillText("HOSTEL ACCESS CARD", 230, 820);
    ctx.fillStyle = mutedColor;
    ctx.font = "16px Arial";
    ctx.fillText("Scan this QR code at the hostel gate", 230, 855);
    ctx.fillText("for secure identity verification.", 230, 880);
    ctx.fillStyle = primaryColor;
    // ctx.font = "bold 15px Arial";
    // ctx.fillText("NON-TRANSFERABLE", 230, 916);

    // Footer
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(50, CARD_H - 40);
    ctx.lineTo(CARD_W - 50, CARD_H - 40);
    ctx.stroke();

    ctx.fillStyle = mutedColor;
    ctx.font = "14px Arial";
    ctx.textAlign = "center";
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
