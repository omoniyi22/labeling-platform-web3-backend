import cors from "cors"
import express from "express"
import userRouter from "./routers/user"
import workerRouter from "./routers/worker"
import env from "dotenv"
import bodyParser from "body-parser"
import uploadImage from "./routers/uploadImage"

env.config()

const app = express();

app.use(cors())
app.use(express.json({ limit: "25mb" }))
app.use(express.urlencoded({ limit: "25mb" }))

app.use(bodyParser.json());

app.use("/v1/user", userRouter);
app.use("/v1/user", uploadImage);
app.use("/v1/worker", workerRouter);

const PORT = process.env.PORT

app.listen(PORT, () => {
    console.log("Saas Project", `listening on ${PORT}`)
})

