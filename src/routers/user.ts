import { Router } from "express"
import uploadImage from "./../uploadImage"
import jwt from "jsonwebtoken";
import { Prisma, PrismaClient } from "@prisma/client";
import { JWT_SECRET, TOTAL_DECIMALS } from "../config";
import { authMiddleware } from "../middleware";
import { createTaskInput } from "../types";
import nacl from "tweetnacl";
import { Connection, PublicKey } from "@solana/web3.js";
import { PUBLIC_WALLET_ADDRESS } from "../util";

// Alchemy RPC connection endpoint
const connection = new Connection("https://solana-devnet.g.alchemy.com/v2/AST8vSberMaE6RY3opJKTHnaKib_YBHD")

const DEFAULT_TITLE = "Select thee next clickable thumbnail"


const TOTAL_SUBMISSION = 100

// const {JWT_SECRET} = process.env

const prismaClient = new PrismaClient();


prismaClient.$transaction(
    async (prisma) => {
        // Code running in a transaction...
    },
    {
        maxWait: 10000, // default: 2000
        timeout: 20000, //default: 5000
    }
)

const router = Router()

// signin with wallet
router.get("/task", authMiddleware, async (req, res) => {
    try {
        // @ts-ignore
        const userId = req.userId

        if (req.query.taskId) {
            // @ts-ignore
            const taskId: string = req.query.taskId

            const taskDetails = await prismaClient.task.findFirst({
                where: {
                    user_id: Number(userId),
                    id: Number(taskId)
                },
                include: {
                    options: true
                }
            })

            if (!taskDetails) {
                return res.status(411).json({
                    message: "You don't have access to this task"
                })
            }

            const result: Record<string, {
                count: number;
                option: {
                    imageUrl: string
                }
            }> = {};

            taskDetails.options.forEach(option => {
                result[option.id] = {
                    count: 0,
                    option: {
                        imageUrl: option.image_url
                    }
                }
            })

            const responses = await prismaClient.submission.findMany({
                where: {
                    task_id: Number(taskId)
                },
                include: {
                    task: true
                }
            })

            responses.forEach((r) => {
                result[r.option_id].count++
            })

            // All Tasks

            res.json({
                result,
                taskDetails
            })

        } else {
            const allTaskDetails = await prismaClient.task.findMany({
                where: {
                    user_id: Number(userId),
                },
            })

            res.json({
                result: allTaskDetails
            })
        }
    } catch (error) {
        res.status(500).json({ message: "Try again" })
    }
})

// signing a message
router.post("/signin", async (req, res) => {
    try {

        const { publicKey, signature } = req.body
        console.log({ publicKey, signature })
        const message = new TextEncoder().encode("Sign into mechanical turks")

        const result = nacl.sign.detached.verify(
            message,
            new Uint8Array(signature.data),
            new PublicKey(publicKey).toBytes(),
        )

        if (!result)
            res.status(401).json({ message: "Auth failed" })

        const existingUser = await prismaClient.user.findFirst({
            where: {
                address: publicKey
            }
        })

        if (existingUser) {
            const token = jwt.sign({
                userId: existingUser.id
            }, JWT_SECRET)

            res.json({
                token
            })

        } else {
            const user = await prismaClient.user.create({
                data: {
                    address: publicKey,
                }
            })

            const token = jwt.sign({
                userId: user.id
            }, JWT_SECRET)

            res.json({
                token
            })
        }
    } catch (error) {
        console.log({ error })
    }
})

// Task
router.post("/task", authMiddleware, async (req, res) => {
    try {
        //@ts-ignore
        const userId = req.userId
        // Validate the inputs from the users
        const body = req.body;

        const user = await prismaClient.user.findFirst({
            where: {
                id: userId
            }
        })

        const parseData = createTaskInput.safeParse(body);

        if (!parseData.success) {
            return res.status(411).json({
                message: "You've sent the wrong inputs"
            })
        }

        // Parse the signature here to ensure the person has passed $50
        console.log(parseData.data.signature)
        const transaction = await connection.getTransaction(parseData.data.signature, {
            maxSupportedTransactionVersion: 1
        })

        console.log(transaction)

        if ((transaction?.meta?.postBalances[1] ?? 0) - (transaction?.meta?.preBalances[1] ?? 0) !== 100000000) {
            return res.status(411).json({
                message: "Transaction signature/amount incorrect"
            })
        }

        if (transaction?.transaction.message.getAccountKeys().get(1)?.toString() !== PUBLIC_WALLET_ADDRESS) {
            return res.status(411).json({
                message: "Transaction sent to wrong address"
            })
        }

        // was this money paid by the user's address
        if (transaction?.transaction.message.getAccountKeys().get(0)?.toString() !== user?.address) {
            return res.status(411).json({
                message: "Transaction sent from wrong address"
            })
        }

        //parse the signature here to ensure the person has paid 0.1 SOL
        //const transaction =  Transaction.from(parseData.data.signature);

        let response = await prismaClient.$transaction(async (tx) => {
            const response = await tx.task.create({
                data: {
                    title: parseData.data.title ?? DEFAULT_TITLE,
                    amount: 0.1 * TOTAL_DECIMALS,
                    signature: parseData.data.signature,
                    user_id: userId
                }
            })

            let option_data = parseData.data.options.map(x => ({
                image_url: x.imageUrl,
                task_id: response.id
            }))

            await tx.option.createMany({
                data: option_data

            })
            return { ...response, options: option_data }

        })

        res.json({
            id: response.id,
            data: response
        })
    } catch (error) {
        res.status(500).json({
            message: "Unsuccessful, Try again"
        })
    }
})

// Upload
router.post("/uploadImage", (req, res) => {
    uploadImage(req.body.image)
        .then((url) => res.send(url))
        .catch((err) => res.status(500).send(err))
    console.log("How far?")

})


export default router;