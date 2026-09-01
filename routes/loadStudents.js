import express from 'express';
import {body, validationResult} from 'express-validator';
import {syncStudents} from '../utils/studentsSync.js';

const router = express.Router();

router.post('/',[
    body('hostelForID')
      .isIn([1, 2, '1', '2'])
      .withMessage("hostelForID must be 1 for boys or 2 for girls")
], async(req, res, next)=> {
    const errors = validationResult(req);
    if(!errors.isEmpty()){
        return res.status(400).json({error: errors.array()});
    }

    try{
        const {hostelForID} = req.body;
        const result = await syncStudents(hostelForID);
        return res.status(200).json({ message: "Successfully loaded", ...result });

    }catch(err){
        return res.status(500).json({error:"Internal server error", message:err.message});
    }
});

export default router;
