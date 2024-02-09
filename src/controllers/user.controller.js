import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import {User} from "../models/user.model.js"
import {deleteFromCloudinary, uploadOnCloudinary} from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js";
import Jwt  from "jsonwebtoken";
import mongoose from "mongoose";

const generateAccessAndRefreshTokens = async (userId) => {
    try {
        const user = await User.findById(userId);

        if (!user) {
            throw new ApiError(404, "User not found");
        }

        const accessToken =  user.generateAccessToken();
        const refreshToken =  user.generateRefreshToken();

        // Update the refreshToken field of the user with the newly generated refresh token
        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });

        return { accessToken, refreshToken };
    } catch (error) {
        console.error("Error generating access and refresh tokens:", error);
        throw new ApiError(500, "Something went wrong while generating refresh and access tokens");
    }
};

const registerUser = asyncHandler(async (req, res) => {
  
 //get user details from frontend
//validation
 //check if user already exist
 //check for images ,check for avatar
 //upload them to cloudinary, avatar
 //create user object - create entry in db
 //remove password and refresh token field from response
 // check for user creation
 // return respose

 const {fullname, email ,username, password }=req.body



 if(
    [fullname , email , username , password].some((field)=>
        field?.trim() ===""
    )
 ) {
    throw new ApiError(400, "All fields are required")
 }

 const existedUser = await User.findOne({
    $or: [{username},{ email }]
})

if(existedUser){
    throw new ApiError(409, "user with email or username already exists")
}

const avatarLocalPath =  req.files?.avatar[0]?.path;
// const coverImagePath = req.files?.coverImage[0]?.path;

let coverImagePath;
if(req.files && Array.isArray(req.files.coverImage) && (req.files.coverImage.length>0)){
    coverImagePath = req.files.coverImage[0].path;
}


if(!avatarLocalPath){
    throw new ApiError(400, "Avatar field will required");
}


const avatar=await uploadOnCloudinary(avatarLocalPath);
const coverImage = await uploadOnCloudinary(coverImagePath)


if(!avatar){
    throw new ApiError(400, "Avatar file is required");
}

 const user = await User.create({
    fullname,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    username: username.toLowerCase(),


})

const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
)

if(!createdUser){
    throw new ApiError(500, "Something went wrong while registering the user")
}

return res.status(201).json(
    new ApiResponse(200, createdUser ,"user registered successfully")
)

});






const loginUser = asyncHandler(async (req, res) => {
    //get data from req body 
    const {email, username, password} = req.body

    //check username or email
    if(!(username || email)){
        throw new ApiError(400, "username or email is required")
    }

    //find the user
    const user = await User.findOne({
        $or: [{username}, {email}]
    })

    if (!user) {
        throw new ApiError(404, "User does not exist")
    }

    //password check
    const isPasswordValid = await user.isPasswordCorrect(password)

    if (!isPasswordValid) {
        throw new ApiError(401, "Password invalid")
    }
    
    //access and refresh token generate
    const {accessToken, refreshToken} = await generateAccessAndRefreshTokens(user._id)

    //send cookie
    const loggedInUser = await User.findById(user._id).
    select("-password -refreshToken")

    const options = {
        httpOnly: true,
        secure: true
    }

    return res.status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(
            200,
            {
                user: loggedInUser, accessToken, refreshToken
            },
            "User logged In Successfully"
        )
    )

})


const logoutUser= asyncHandler(async(req,res)=>{
 await User.findByIdAndUpdate(
    req.user._id,
    {
        $unset: {
            refreshToken: 1
        }
    },
    {
        new: true
    }
  )
  const options = {
    httpOnly: true,
    secure: true
  }

  return res.
  status(200)
  .clearCookie("accessToken", options)
  .clearCookie("refreshToken",options)
  .json(new ApiResponse(200, {} ,"User logged out"))
})



    const refreshAccessToken=asyncHandler(async (req,res)=>{
       const incomingRefreshToken = req.cookies.refreshToken || req.body
    
       if(!incomingRefreshToken){
        throw new ApiError(401,"unauthorized request")
       }
       try {
       const decodedToken = jwt.verify(
        incomingRefreshToken,
        process.env.REFRESH_TOKEN_SECRET
       )
      const user = await User.findById(decodedToken?._id)
      if(!user){
        throw new ApiError(401,"Invalid refresh Token")
      }
      if(incomingRefreshToken !== user?.refreshToken){
        throw new ApiError(401, "refresh token is expired or used ")
    
      }
    
      const options={
        httpOnly:true,
        secure: true
      }
    
      const{accessToken,newrefreshToken} = await generateAccessAndRefreshTokens(user._id)
      return res.status(200)
      .cookie("accessToken",accessToken,options)
      .cookie("refreshToken",newrefreshToken,options)
      .json(
        new ApiResponse(
            200,
            {accessToken, refreshToken:newrefreshToken},
            "Access token refreshed"
    
        )
      )
   
} catch (error) {
    throw new ApiError(401, error?.message || "invalid refresh token")
}
})


const changeCurrentPassword = asyncHandler(async(req,res)=>{
    const {oldPassword , newPassword} = req.body

 const user = await  User.findById( req.user?._id)
 const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

 if(!isPasswordCorrect){
    throw new ApiError(400, "Invalid Old Password");
}

user.password = newPassword

await user.save({validateBeforeSave: false})

return res
.status(200)
.json(new ApiResponse(200,{},"Password changed successfully"))


})
const getCurrentUser = asyncHandler( async(req,res)=>{
    return res
    .status(200)
    .json(new ApiResponse(200,req.user,"cureent user fetched successfully") )
})

const UpdateAccountDetails = asyncHandler(async(req,res)=>{
    const {fullname , email} = req.body


    if(!fullname || !email){
        throw new ApiError(400,"All fields are required")
    }
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullname,
                email: email
            }
        },
        
        {new: true}

        
        
        ).select("-password")

        return res
        .status(200)
        .json(new ApiResponse(200, user , "Account details updated successfully"))
})


const updateUserAvatar = asyncHandler(async(req, res)=>{
    const avatarLocalPath = req.file?.path

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar file is missing")
    }

    const prevAvatar = user.avatar
    if(prevAvatar.public_id){
        await deleteFromCloudinary(prevAvatar.public_id)
    }


    const avatar = await uploadOnCloudinary(avatarLocalPath)
    if(!avatar.url){
        throw new ApiError(400, "error while uploading on avatar")
    }

    const user = await User.findByIdAndUpdate(
        req.User?._id,
        {
            $set:{
            avatar:avatar.url

            }
        },
        {new : true}
    ).select("-password");

    return res
    .status(200)
    .json(
        new ApiResponse(200 , user , "avatar image updated successfully")
    )
})

const updateUserCoverImage = asyncHandler(async(req, res)=>{
    const coverImageLocalPath = req.file?.path

    if(!coverImageLocalPath){
        throw new ApiError(400, "cover image file is missing")
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath)
    if(!coverImage.url){
        throw new ApiError(400, "error while uploading on cover Image")
    }

    const user = await User.findByIdAndUpdate(
        req.User?._id,
        {
            $set:{
           coverImage :coverImage.url

            }
        },
        {new : true}
    ).select("-password");

    return res
    .status(200)
    .json(
        new ApiResponse(200 , user , "cover image updated successfully")
    )

})

const getUserChannelProfile = asyncHandler(async(req,res)=>{
    const {username} = req.params

    if(!username?.trim()){
        throw new ApiError(400,"username is mssing")
    }

   const channel = await User.aggregate([
    {

    $match: {
        username : username?.toLowerCase()
    }

   },
   {
    $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "subscribers"

    }
   },
   {
    $lookup:{
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribedTo"
    }
   },
   {
    $addFields:{
        subscribersCount :{
            $size: "$subscribers"

        },
        channelsSubscribedToCount:{
            $size: "$subscribedTo"
        },
        isSubscribed:{
            $cond:{
                if: {$in: [req.user?._id,"$subscribers.subscriber"]},
                then:true,
                else: false
            }
        }

    }
   },
   {
    $project: {
        fullname: 1,
        username:1,
        subscribersCount:1,
        channelsSubscribedToCount:1,
        isSubscribed:1,
        avatar:1,
        coverImage:1,
        email:1
    }
   }
])

if(!channel?.length){
    throw new ApiError(404, "channel does not exists")
}

return res
.status(200)
.json(
    new ApiResponse(200,channel[0],"User channel fetched successfully")
)
})

const getWatchHistory = asyncHandler(async(req,res)=>{
const user = await User.aggregate([
    {
        $match: {
            _id: new mongoose.Types.ObjectId(req.user._id)
        }
    },
    {
        $lookup:{
            from:"videos",
            localField: "watchHistory",
            foreignField: "_id",
            as: "watchHistory",
            pipeline:[
                {
                    $lookup: {
                        from:"users",
                        localField: "owner",
                        foreignField:"_id",
                        as: "owner",
                        pipeline: [
                            {
                                $project: {
                                    fullname:1,
                                    username:1,
                                    avatar:1
                                }

                            },
                            {
                                $addFields: {
                                    owner:{
                                        $first: "$owner"
                                    }
                                }
                            }

                        ]

                    }
               
            
           
           
            }
        ]
        
        }

        
    }
])
return res
.status(200)
.json(
    new ApiResponse(
        200,
        user[0].watchHistory,
        "watch history fetched successfully"
    )
)
})


export { 
    registerUser,
    loginUser,
    logoutUser ,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    UpdateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory
};