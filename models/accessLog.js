import mongoose from "mongoose";

const accessLogSchema = new mongoose.Schema({
    logId: { type: String, required: true, unique: true },
    studentID:{type: mongoose.Schema.Types.ObjectId, ref:'students', required:true},
    rollNo:{type:String, required: true},
    fullName:{type:String, required: true},
    hostelName:{type:String, required: true},
    blockName:{type:String, required: true},
    roomNo:{type:String, required: true},
    hostelID:{type:Number, required: true},
    blockID:{type:Number, required: true},
    deviceID:{type:String, required: false},
    logDate:{type:Date, required: true},
    direction:{type:String, required: true},
    qrcode:{type: String},

    syncStatus: { type: String, default: "PENDING" },
    syncedAt: { type: Date },
    image:{data:Buffer, contentType: String}
});

accessLogSchema.index({ studentID: 1, logDate: -1, rollNo: 1 });

export default mongoose.model('accessLog',accessLogSchema);