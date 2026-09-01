import axios from "axios";
import cron from "node-cron";
import mongoose from "mongoose";
import Student from "../models/students.js";

const HOSTELS = [
  { id: 1, label: "boys" },
  { id: 2, label: "girls" },
];

let studentsSyncRunning = false;

function mapPhpToMongo(row) {
  return {
    hostelApplicationID: Number(row.HOSTEL_APPLICATION_ID),
    hostelForName: row.HOSTEL_FOR_NAME,
    year: Number(row.YEAR),
    stayFrom: new Date(row.STAY_FROM),
    stayTo: new Date(row.STAY_TO),
    rollNo: row.ROLL_NO,
    challanAmount: row.CHALLAN_AMOUNT
      ? mongoose.Types.Decimal128.fromString(row.CHALLAN_AMOUNT)
      : null,
    paidAmount: row.PAID_AMOUNT
      ? mongoose.Types.Decimal128.fromString(row.PAID_AMOUNT)
      : null,
    paidDate: row.PAID_DATE ? new Date(row.PAID_DATE) : null,
    paymentMode: row.PAYMENT_MODE,
    active: Number(row.ACTIVE),
    hostelName: row.HOSTEL_NAME,
    blockName: row.BLOCK_NAME,
    hostelID: Number(row.HOSTEL_ID),
    blockID: Number(row.BLOCK_ID),
    roomNo: row.ROOM_NO,
    typeCode: row.TYPE_CODE,
    hostelAnnouncementID: Number(row.HOSTEL_ANNOUNCEMENT_ID),
    challanID: Number(row.CHALLAN_ID),
    challanNo: Number(row.CHALLAN_NO),
    campusName: row.CAMPUS_NAME,
    firstName: row.FIRST_NAME,
    lastName: row.LAST_NAME,
    userID: Number(row.USER_ID),
    fName: row.FNAME,
    MobileNo: row.MOBILE_NO,
    email: row.EMAIL,
    profileImage: row.PROFILE_IMAGE,
    programTypeTitle: row.PROGRAM_TYPE_TITLE,
    programTitle: row.PROGRAM_TITLE,
    shiftName: row.SHIFT_NAME,
    CnicNo: row.CNIC_NO,
    image: row.IMAGE_BASE64 ? Buffer.from(row.IMAGE_BASE64, "base64") : null,
  };
}

export async function syncStudents(hostelForID) {
  const normalizedHostelForID = Number(hostelForID);
  if (!HOSTELS.some(({ id }) => id === normalizedHostelForID)) {
    throw new Error("hostelForID must be 1 for boys or 2 for girls");
  }

  const phpApiUrl = `https://itsc.usindh.edu.pk/sac/api/get_hostelers/${normalizedHostelForID}`;
  const response = await axios.get(phpApiUrl, { timeout: 300000 });

  if (response.data.type !== "success") {
    throw new Error(response.data.message || `Student API failed for hostel ${normalizedHostelForID}`);
  }

  const students = response.data.data;
  if (!Array.isArray(students) || students.length === 0) {
    throw new Error(`No student data returned for hostel ${normalizedHostelForID}`);
  }

  const bulkOps = students.map((row) => {
    const student = mapPhpToMongo(row);
    return {
      updateOne: {
        filter: { rollNo: student.rollNo },
        update: { $set: student },
        upsert: true,
      },
    };
  });

  const result = await Student.bulkWrite(bulkOps, {
    ordered: false,
    wtimeout: 300000,
  });

  return {
    hostelForID: normalizedHostelForID,
    total: students.length,
    inserted: result.upsertedCount,
    modified: result.modifiedCount,
    matched: result.matchedCount,
  };
}

async function syncAllStudents() {
  if (studentsSyncRunning) {
    console.log("Student sync is still running; skipping this schedule.");
    return;
  }

  studentsSyncRunning = true;
  try {
    const results = await Promise.allSettled(
      HOSTELS.map(({ id }) => syncStudents(id)),
    );

    results.forEach((result, index) => {
      const hostel = HOSTELS[index];
      if (result.status === "fulfilled") {
        console.log(
          `Student sync completed for ${hostel.label} (${hostel.id}): ${result.value.total} records`,
        );
      } else {
        console.error(
          `Student sync failed for ${hostel.label} (${hostel.id}):`,
          result.reason?.message || result.reason,
        );
      }
    });
  } finally {
    studentsSyncRunning = false;
  }
}

// Run at minute 0, 5, 10, ... of every hour.
cron.schedule("0 */12 * * *", syncAllStudents);
