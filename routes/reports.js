import express from 'express';
import { body, validationResult } from 'express-validator';
import Student from '../models/students.js'; 
import accessLog from '../models/accessLog.js';

const router = express.Router();

router.post('/recent-log', [
    body('hostel_for_id').notEmpty().withMessage("Select hostel for")
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ error: errors.array() });
    }

    try {
        const { hostel_for_id } = req.body;
        let hostelForName = null;
        if (hostel_for_id == 1) hostelForName = "BOYS HOSTEL";
        else if (hostel_for_id == 2) hostelForName = "GIRLS HOSTEL";

        const pipeline = [
            // 1. Sort logs by newest first
            { $sort: { logDate: -1 } },

            // 2. Group by rollNo (since studentID is null in your DB)
            {
                $group: {
                    _id: "$rollNo", 
                    latestLog: { $first: "$$ROOT" }
                }
            },

            // 3. Restore the original log document structure
            { $replaceRoot: { newRoot: "$latestLog" } },

            // 4. Lookup by matching rollNo strings (very reliable)
            {
                $lookup: {
                    from: "students", 
                    localField: "rollNo",
                    foreignField: "rollNo",
                    as: "student"
                }
            },

            // 5. Unwind the student object array
            { $unwind: "$student" },

            // 6. Filter results by hostel target
            ...(hostelForName ? [
                {
                    $match: {
                        "student.hostelForName": hostelForName
                    }
                }
            ] : []),

            // 7. Structure the final payload mapping
            {
                $project: {
                    _id: 0,
                    logId: 1,
                    logDate: 1,
                    direction: 1,
                    deviceID: 1,
                    hostelName: 1,
                    blockName: 1,
                    roomNo: 1,
                    hostelID: 1,
                    blockID: 1,
                    student: {
                        firstName: "$student.firstName",
                        lastName: "$student.lastName",
                        hostelForName: "$student.hostelForName",
                        programTitle: "$student.programTitle",
                        shiftName: "$student.shiftName",
                        MobileNo: "$student.MobileNo",
                        email: "$student.email",
                        rollNo: "$student.rollNo"
                    }
                }
            },

            // 8. Re-apply chronological order
            { $sort: { logDate: -1 } }
        ];

        const result = await accessLog.aggregate(pipeline);
        
        if (!result || result.length === 0) {
            return res.status(404).json({ error: 'No records found matching criteria.' });
        }

        return res.status(200).json({ message: "Successful", data: result});

    } catch (err) {
        return res.status(500).json({ error: "Internal server error", message: err.message });
    }
});

export default router;
