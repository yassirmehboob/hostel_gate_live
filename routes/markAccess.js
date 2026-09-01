import express from 'express';
import {body, validationResult} from 'express-validator';
import Student from '../models/students.js';
import accessLog from '../models/accessLog.js';
import { TZDate } from "@date-fns/tz";
import { format, addDays } from "date-fns";
import { randomUUID } from "crypto";

const router = express.Router();
const COOLDOWN_SECONDS = 10;
const timeZone = 'Asia/Karachi';

function extractBase64Image(value) {
//   console.log(typeof value);
    if (!value || typeof value != "string") return null;

  // supports:
  // data:image/jpeg;base64,...
  // data:image/png;base64,...
  // plain base64 string
  if (value.includes("base64,")) {
    return value.split("base64,")[1];
  }

  return value;
}

function getImageContentType(value) {
  if (!value || typeof value != "string") return "image/jpeg";

  const match = value.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,/);
  return match ? match[1] : "image/jpeg";
}

function isValidBase64(value) {
  if (!value || typeof value !== "string") return false;

  const base64 = extractBase64Image(value)?.trim();
  if (!base64) return false;

  const base64Regex =
    /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

  return base64Regex.test(base64);
}

function studentImageToBase64(img) {
  if (!img) return null;

  // format: { data: Buffer, contentType: String }
  if (img.data) {
    if (Buffer.isBuffer(img.data)) {
      return img.data.toString("base64");
    }
    if (img.data.buffer) {
      return Buffer.from(img.data.buffer).toString("base64");
    }
  }

  // format: direct Buffer
  if (Buffer.isBuffer(img)) {
    return img.toString("base64");
  }

  // format: BSON Binary
  if (img.buffer) {
    return Buffer.from(img.buffer).toString("base64");
  }

  return null;
}

router.post('/',[
    body('rollNo').notEmpty().withMessage("Roll Number is required"),
    body('direction').notEmpty().withMessage("IN/OUT is required."),
    body('qrcode').notEmpty().withMessage("Qrcode is required"),
    body("searchBy").notEmpty(),
    body("taken_photo")
      .optional({ nullable: true, checkFalsy: true })
      .custom((value) => {
        if (!isValidBase64(value)) {
          throw new Error("Image must be a valid base64 string.");
        }
        return true;
      }),
], async(req, res, next)=> {
    const errors = validationResult(req);
    if(!errors.isEmpty()){
        return res.status(400).json({error: errors.array()});
    }

    try{
        const {rollNo, direction, qrcode, searchBy, taken_photo} = req.body;

        let std = null;
        if(searchBy == "rollNo"){
             std = await Student.findOne({rollNo:rollNo})
        }else if(searchBy == "cnicNo"){
             std = await Student.findOne({CnicNo:rollNo})
        }else{
            return res.status(400).json({ error: `invalid search type.` });
        }
        
        if (!std) return res.status(400).json({ error: `${rollNo} is not found.` });

        if(std.active == 0) return res.status(400).json({ error: `allotment is disabled.` });
        
        const now = new Date();
        const zonedDate = new TZDate(now,timeZone);
        const expiryPK = new TZDate(std.stayTo, timeZone);
        const expiryWithGrace = addDays(expiryPK, 30);

        if (zonedDate > expiryWithGrace) {
            return res.status(400).json({
                                        error: "Your allotment is expired (grace period over).",
                                        });
        }

        const lastLog = await accessLog.findOne({ studentID: std._id }).sort({ logDate: -1 });

        if (lastLog && (now - lastLog.logDate) / 1000 < COOLDOWN_SECONDS) {
            return res.status(400).json({
                error: `You already scanned recently. Wait ${Math.ceil(COOLDOWN_SECONDS - (now - lastLog.logDate) / 1000)} seconds.`
            });
        }

        let scannedImage = null;
        if (taken_photo) {
            const base64Data = extractBase64Image(taken_photo);
            const contentType = getImageContentType(taken_photo);
            
            scannedImage = {
                data: Buffer.from(base64Data, "base64"),
                contentType,
            };
      }

        const log = {
                logId: randomUUID(),
                studentID:std._id,
                rollNo:std.rollNo,
                fullName:`${std.firstName} ${std.lastName}`,
                hostelName:std.hostelName,
                blockName:std.blockName,
                roomNo:std.roomNo,
                hostelID:std.hostelID,
                blockID:std.blockID,
                deviceID:null,
                logDate:now,
                direction:direction,
                qrcode:qrcode,
                image: scannedImage
            }
            
            const logAcp = await accessLog.create(log);

            return res.status(200).json({message: "Successful", data:{
                rollNo:std.rollNo,
                active:std.active,
                blockName:std.blockName,
                firstName:std.firstName,
                fName:std.fName,
                hostelForName:std.hostelForName,
                hostelName:std.hostelName,
                lastName:std.lastName,
                programTitle:std.programTitle,
                roomNo:std.roomNo,
                shiftName:std.shiftName,
                stayFrom:std.stayFrom,
                stayTo:std.stayTo,
                year:std.year,
                image: std.image,
            }, scanTime:logAcp.logDate});

}catch(err){
        return res.status(500).json({error:"Internal server error", message:err.message});
    }
});

export default router;