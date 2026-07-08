import User from "../models/user.model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import path from "path";
import fs from "fs";
import { OAuth2Client } from "google-auth-library";
import { v2 as cloudinary } from "cloudinary";

const getGoogleClient = () =>
  new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    "postmessage"
  );

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const uploadAvatarToCloudinary = (file) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "maa-janki-bakery/avatars" },
      (error, result) => {
        if (error) return reject(error);
        resolve(result.secure_url);
      }
    );
    stream.end(file.buffer);
  });

const formatUserResponse = (user) => ({
  name: user.name,
  email: user.email,
  avatar: user.avatar,
  cartItems: user.cartItems || {},
  dob: user.dob || "",
  gender: user.gender || "",
  phoneNumber: user.phoneNumber || "",
  address: user.address || "",
  city: user.city || "",
  state: user.state || "",
  pincode: user.pincode || "",
});

const getCookieOptions = (req) => {
  const isHttps =
    req.secure || req.get("x-forwarded-proto") === "https";

  return {
    httpOnly: true,
    secure: isHttps,
    sameSite: isHttps ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
};

const setAuthCookie = (req, res, token) => {
  res.cookie("token", token, {
    ...getCookieOptions(req),
  });
};

//register user : /api/user/register

export const registerUser=async(req,res)=>{
  try{
      const {name,email,password}=req.body 
    if(!name || !email || !password){
      return res
       .status(400)
       .json({message: "All fields are required",success:false});
    }

    if (!EMAIL_REGEX.test(email.trim())) {
      return res
        .status(400)
        .json({ message: "Invalid email format", success: false });
    }

    if (password.length < 8) {
      return res.status(400).json({
        message: "Password must be at least 8 characters",
        success: false,
      });
    }

     const existingUser=await User.findOne({email: email.trim().toLowerCase()});
    if(existingUser){
    return res
     .status(400)
     .json({message:"User already exists",success:false});
   }
    const hashedPassword=await bcrypt.hash(password,10);
    const user=await User.create({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password:hashedPassword,
   }); 
    
    const token=jwt.sign({id:user._id},process.env.JWT_SECRET,
      {expiresIn: "7d" ,} );

     setAuthCookie(req, res, token);
   res.json({
        message:"User registered Successfully",
         success:true,
        user: formatUserResponse(user),
        token,
   
   });     
  }
  catch(error){
    console.log(error);
    res.status(500).json({message:"Internal server error"});
  }
 };

     export const loginUser=async(req,res)=>{
 try{
         const {email,password}=req.body;
        if(!email || !password){
                   return res.status(400)
                   .json({message:"All fields are requires",success:false});
            }
       const user=await User.findOne({email});
      if(!user){
            return res
            .status(400)
            .json({message:"Invalid email or password", success:false});

     }

        if(!user.password){
           return res
           .status(400)
           .json({message:"This account uses Google sign-in. Please continue with Google.",success:false});
        }

        const isMatch=await bcrypt.compare(password,user.password);
        if(!isMatch){
           return res
           .status(400)
           .json({message:"Invalid email or password",success:false});      
        }
       const token=jwt.sign({ id:user._id }, process.env.JWT_SECRET,
{  expiresIn:"7d"                
       });
      setAuthCookie(req, res, token);
   res.json({
        message:"Logged in successfully",
         success:true,
        user: formatUserResponse(user),
        token,
   
   });     


      }
      catch(error){ 
         console.log(error);
         res.status(500).json({message:"Internal server error"});
         }
  };

export const googleAuthUser = async (req, res) => {
  try {
    const { credential, code } = req.body;

    if (!credential && !code) {
      return res
        .status(400)
        .json({ message: "Google authentication failed", success: false });
    }

    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      return res.status(503).json({
        message: "Google sign-in is not configured on the server",
        success: false,
      });
    }

    let googleId;
    let email;
    let name;
    let picture;
    const googleClient = getGoogleClient();

    if (credential) {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      googleId = payload.sub;
      email = payload.email;
      name = payload.name;
      picture = payload.picture;
    } else {
      const { tokens } = await googleClient.getToken({
        code,
        redirect_uri: "postmessage",
      });
      const ticket = await googleClient.verifyIdToken({
        idToken: tokens.id_token,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      googleId = payload.sub;
      email = payload.email;
      name = payload.name;
      picture = payload.picture;
    }

    if (!email || !googleId) {
      return res
        .status(400)
        .json({ message: "Unable to verify Google account", success: false });
    }

    let user = await User.findOne({ $or: [{ googleId }, { email }] });

    if (user) {
      if (user.password && !user.googleId) {
        return res.status(400).json({
          message:
            "An account with this email already exists. Please sign in with your password.",
          success: false,
        });
      }

      if (!user.googleId) {
        user.googleId = googleId;
      }
      if (!user.avatar && picture) {
        user.avatar = picture;
      }
      if (!user.name && name) {
        user.name = name;
      }
      await user.save();
    } else {
      user = await User.create({
        name: name || email.split("@")[0],
        email,
        googleId,
        avatar: picture || null,
      });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    setAuthCookie(req, res, token);

    res.json({
      message: "Signed in with Google successfully",
      success: true,
      user: formatUserResponse(user),
      token,
    });
  } catch (error) {
    console.error("Google auth error:", error.message);
    res.status(500).json({ message: "Google sign-in failed", success: false });
  }
};

  //logout user:api/user/logout
  
 export const logoutUser=async(req,res)=>{
   try{
     res.clearCookie("token", getCookieOptions(req));
    res.json({message:"User logged out successfully",success:true});  
    }
      catch(error){ 
          console.log(error);
          res.status(500).json({message:"Internal server error"});
         }
 };

//check auth user

export const isAuthUser=async(req,res)=>{
  try{
       const userId=req.user;
    if(!userId){
           return res.json({message:"Not signed in",success:false});
    }
     const user=await User.findById(userId).select("-password");
    res.json({
      success:true,
     user:{
       name:user.name,
       email:user.email,
       avatar:user.avatar,
       cartItems:user.cartItems || {},
       dob:user.dob,
       gender:user.gender,
       phoneNumber:user.phoneNumber,
       address:user.address,
       city:user.city,
       state:user.state,
       pincode:user.pincode,
     },
   });
  }
  catch(error){
          console.log(error);
          res.status(500).json({message:"Internal server error"});
 
 
   }
};

// upload avatar : /api/user/avatar
export const uploadAvatar = async (req, res) => {
  try {
    const userId = req.user;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorised", success: false });
    }
    if (!req.file) {
      return res.status(400).json({ message: "Avatar file required", success: false });
    }
    const avatarUrl = await uploadAvatarToCloudinary(req.file);
    const user = await User.findByIdAndUpdate(
      userId,
      { avatar: avatarUrl },
      { new: true }
    ).select("-password");
    return res.json({
      success: true,
      message: "Avatar updated",
      user: {
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        dob: user.dob,
        gender: user.gender,
        phoneNumber: user.phoneNumber,
        address: user.address,
        city: user.city,
        state: user.state,
        pincode: user.pincode,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error", success: false });
  }
};

// delete avatar : /api/user/avatar (DELETE)
export const deleteAvatar = async (req, res) => {
  try {
    const userId = req.user;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorised", success: false });
    }

    const user = await User.findById(userId).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found", success: false });
    }

    const currentAvatar = user.avatar;
    if (currentAvatar && currentAvatar.startsWith("/images/")) {
      const filename = currentAvatar.replace("/images/", "");
      const filePath = path.join(process.cwd(), "uploads", filename);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (err) {
          console.error("Failed to delete avatar file", err);
        }
      }
    }

    user.avatar = null;
    await user.save();

    return res.json({
      success: true,
      message: "Avatar removed",
      user: {
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        dob: user.dob,
        gender: user.gender,
        phoneNumber: user.phoneNumber,
        address: user.address,
        city: user.city,
        state: user.state,
        pincode: user.pincode,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error", success: false });
  }
};

// update user profile : /api/user/update-profile
export const updateUserProfile = async (req, res) => {
  try {
    const userId = req.user;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorised", success: false });
    }

    const allowedFields = [
      "name",
      "dob",
      "gender",
      "phoneNumber",
      "address",
      "city",
      "state",
      "pincode",
    ];
    const profileUpdates = {};

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        profileUpdates[field] = req.body[field];
      }
    });

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      profileUpdates,
      { new: true, runValidators: true }
    ).select("-password");

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found", success: false });
    }

    res.json({
      success: true,
      message: "Profile updated successfully",
      user: {
        name: updatedUser.name,
        email: updatedUser.email,
        avatar: updatedUser.avatar,
        dob: updatedUser.dob || "",
        gender: updatedUser.gender || "",
        phoneNumber: updatedUser.phoneNumber || "",
        address: updatedUser.address || "",
        city: updatedUser.city || "",
        state: updatedUser.state || "",
        pincode: updatedUser.pincode || "",
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error", success: false });
  }
};


















