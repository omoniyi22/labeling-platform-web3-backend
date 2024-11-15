import { v2 as cloudinary } from "cloudinary"
import { UploadApiOptions } from "cloudinary/types"
import env from "dotenv"
env.config()

const API_KEY = process.env.API_KEY
const API_SECRET = process.env.API_SECRET
const CLOUD_NAME = process.env.CLOUD_NAME

cloudinary.config({
    cloud_name: CLOUD_NAME,
    api_key: API_KEY,
    api_secret: API_SECRET
})

const opts: (userId: string) => UploadApiOptions = (userId: string) => ({
    overwrite: true,
    invalidate: true,
    resource_type: "image",
    filename_override: `${userId}/${Math.random()}`
})

export default (image: any) => { //image - > based64
    return new Promise((resolve, reject) => {
        cloudinary.uploader.upload(image, opts("first"), (error: any, result) => {
            if (result && result.secure_url) {
                console.log(result.secure_url);
                return resolve(result.secure_url);
            }
            console.log(error.message);
            return reject({ message: error.message })
        })
    })
}