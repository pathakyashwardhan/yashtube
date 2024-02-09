import {v2 as cloudinary} from "cloudinary"
import fs from "fs"


          
cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET 
});

const uploadOnCloudinary = async (localFilePath)=>{
    try {
        if(!localFilePath) return null

     const response = await  cloudinary.uploader.upload(localFilePath,{
        resource_type: "auto"
      });
      // console.log("file is uploaded on cloudinary",
      // response.url);
      
      fs.unlinkSync(localFilePath);

      return response;
    } catch (error) {
        fs.unlinkSync(localFilePath) //remove the locally saved file as the operation get failed
     return null;
    }
}

const deleteFromCloudinary = async(public_id, resource_type)=>{
  try {
    if(!public_id){
      return null;
    }

    const response = await cloudinary.uploader.destroy(public_id,{resource_type})
    return response
  } catch (error) {
    console.log(error)
    return null
  }
}


export {uploadOnCloudinary,deleteFromCloudinary}