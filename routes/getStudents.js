import express from 'express';
import {body, validationResult} from 'express-validator';
import Student from '../models/students.js';
import accessLog from '../models/accessLog.js';

const router = express.Router();

router.post('/get_students',[
    body('hostel_for_id').notEmpty().withMessage("Select hostel for")
],async (req,res)=>{
    const errors = validationResult(req);
    if(!errors.isEmpty()){
        return res.status(400).json({error: errors.array()});
    }

    try{
        const {hostel_for_id} = req.body;
        let hostelForName = null;
        if (hostel_for_id == 1)
            hostelForName = "BOYS HOSTEL"
        else if(hostel_for_id == 2)
            hostelForName = "GIRLS HOSTEL"

        const students = await Student.find({hostelForName:hostelForName});
        
        if(!students){
            return res.status(400).json({error: 'allotment not found'});
        }

        return res.status(200).json({message: "Successful", data:students});

    }catch(err){
        return res.status(500).json({error:"Internal server error", message:err.message});
    }

});

router.post('/get_log',[
    body('roll_no').notEmpty().withMessage("Select Roll number")
],async (req,res)=>{
    const errors = validationResult(req);
    if(!errors.isEmpty()){
        return res.status(400).json({error: errors.array()});
    }

    try{
        const {roll_no} = req.body;

        const log = await accessLog.find({rollNo:roll_no}).sort({logDate:-1});
        
        if(!log){
            return res.status(400).json({error: 'log not found'});
        }

        return res.status(200).json({message: "Successful", data:log});

    }catch(err){
        return res.status(500).json({error:"Internal server error", message:err.message});
    }

});

export default router;