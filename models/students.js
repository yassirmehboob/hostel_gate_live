import mongoose from "mongoose";

const studentSchema = new mongoose.Schema({
    hostelApplicationID :{type:Number, index:true, required: true},
    hostelForName:{type:String, required: true},
    year:{type:Number, required: true},
    stayFrom:{type:Date, required: true},
    stayTo:{type:Date, required: true},
    rollNo:{type:String, unique:true, required: true},
    challanAmount:{type: mongoose.Schema.Types.Decimal128, required: false},
    paidAmount:{type: mongoose.Schema.Types.Decimal128, required: false},
    paidDate:{type:Date, required: false},
    paymentMode:{type:String, required: false},
    active:{type:Number, required: true},
    hostelName:{type:String, required: true},
    blockName:{type:String, required: true},
    hostelID:{type:Number, required: true},
    blockID:{type:Number, required: true},
    roomNo:{type:String, required: true},
    typeCode:{type:String, required: false},
    hostelAnnouncementID:{type:Number,index:true, required: true},
    challanID:{type:Number, required: true},
    challanNo:{type:Number, required: true},
    campusName:{type:String, required: false},
    firstName:{type:String, required: true},
    lastName:{type:String, required: false},
    userID:{type:Number, index:true, required: true},
    fName:{type:String, required: false},
    MobileNo:{type:String, required: false},
    email:{type:String, required: false},
    profileImage:{type:String, required: false},
    programTypeTitle:{type:String, required: false},
    programTitle:{type:String, required: true},
    shiftName:{type:String, required: true},
    image:{data:Buffer, contentType: String},
    CnicNo:{type:String, required:false },

}, { 
    timestamps: true
});

studentSchema.index({ hostelForName: 1, firstName: 1, fName:1, lastName:1, year:1, rollNo: 1 });

export default mongoose.model('students',studentSchema)