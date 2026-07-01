import mongoose from "mongoose";

const userSchema=new mongoose.Schema({
   name:{
          type:String,
           required:true,
        },
    email:{
          type:String,
           required:true,
           unique:true,
    },
    password:{
          type:String,
          default:"",
     },
    googleId:{
          type:String,
          unique:true,
          sparse:true,
     },
    cartItems:{type:Object ,default:{} },
    avatar:{
      type:String,
      default:null
    },
    dob: { type: String, default: "" },
    gender: { type: String, default: "" },
    phoneNumber: { type: String, default: "" },
    address: { type: String, default: "" },
    city: { type: String, default: "" },
    state: { type: String, default: "" },
    pincode: { type: String, default: "" }
 },
  {minimize:false}
);
  
 const User=mongoose.model("User",userSchema);

 export default User;
 