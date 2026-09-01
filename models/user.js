import mongoose from "mongoose";

const loginSchema = new mongoose.Schema({
    username:{type:String, unique:true, required:true},
    password:{type:String, required:true},
    hostelForID:{type:Number, required:true},
    lastSync:{type:Date, default:null},
    logPicture:{type:Boolean, default: false},
}, { 
    timestamps: true
});

export default mongoose.model('user',loginSchema);