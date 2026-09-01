import express from 'express';
import {body, validationResult} from 'express-validator';
import user from '../models/user.js';
import {hashPassword, verifyPassword} from '../utils/password.js';
import {generateToken} from '../utils/jwt.js';

const router = express.Router();

router.post('/register',[
    body('username').notEmpty().withMessage("Roll Number is required"),
    body('password').notEmpty().withMessage("password is required."),
    body('hostelForID').notEmpty().withMessage("Hostel for ID is required")
], async(req,res)=>{
    
    const errors = validationResult(req);
    if(!errors.isEmpty()){
        return res.status(400).json({error: errors.array()});
    }

    try{
        const {username,password, hostelForID} = req.body;
        const hash = await hashPassword(password);

        const userlog = {
            username:username,
            password:hash,
            hostelForID:hostelForID,
        };

        await user.create(userlog);
        return res.status(200).json({message: "Account successfully created"})

    }catch(err){
        return res.status(500).json({error:"Internal server error", message:err.message});
    }

});

router.post('/login',[
    body('username').notEmpty().withMessage("Roll Number is required"),
    body('password').notEmpty().withMessage("password is required.")
], async(req,res)=>{
    
    const errors = validationResult(req);
    if(!errors.isEmpty()){
        return res.status(400).json({error: errors.array()});
    }

    try{
        const {username,password} = req.body;
        const account = await user.findOne({username:username});
        if(!account){
            return res.status(400).json({error:"Invalid username"});
        }

        const isMatched = await verifyPassword(password,account.password);
        if (!isMatched){
             return res.status(400).json({error:"Invalid password"});
        }

        const token = generateToken({
        id: account._id,
        username: account.username,
        hostelForID: account.hostelForID
        });
    
        return res.status(200).json({message: "Login successful", token:token, user:account});

    }catch(err){
        return res.status(500).json({error:"Internal server error", message:err.message});
    }

});

router.post('/forget-password',[
    body('username').notEmpty().withMessage("Roll Number is required"),
    body('password').notEmpty().withMessage("password is required.")
], async(req,res)=>{
    
    const errors = validationResult(req);
    if(!errors.isEmpty()){
        return res.status(400).json({error: errors.array()});
    }

    try{
        
        const {username,password} = req.body;
        
        const hash = await hashPassword(password);
        await user.findOneAndUpdate({username},{password:hash});
       
        return res.status(200).json({message: `${username} password reset successfully`});

    }catch(err){
        return res.status(500).json({error:"Internal server error", message:err.message});
    }

});

export default router;
