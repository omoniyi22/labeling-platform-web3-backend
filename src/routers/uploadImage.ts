import { Router } from "express"
import multiparty from "multiparty"
import cloudinary from "cloudinary";

cloudinary.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
})

const router = Router()

router.post("/img_upload", async function handle(req, res) {
    try {
        const form = new multiparty.Form()
        const { fields, files }: any = await new Promise((resolve, reject) => {
            form.parse(req, (err, fields, files) => {
                if (err) reject(err);
                resolve({ fields, files })
            })
        })

        console.log("here", { files })


        const links = [];
        for (const file of files.file) {
            console.log({ file })
            const result = await cloudinary.v2.uploader.upload(file.path, {
                folder: "ecommerce",
                public_id: `file_${Date.now()}`,
                resource_type: 'auto',
            })

            const link = result.secure_url;
            links.push(link);
        }
        // console.log({ links })
        res.json({ links });
    } catch (error) {
        console.log({ error })
    }
})

export default router;
export const config = {
    api: { bodyParser: false }
} 