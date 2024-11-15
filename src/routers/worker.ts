import { Response, Router } from "express"
import jwt from "jsonwebtoken";
import { Prisma, PrismaClient } from "@prisma/client";
import { TOTAL_DECIMALS, WORKER_JWT_SECRET } from "../config";
import { workerMiddleware } from "../middleware";
import { getNextTask } from "../db";
import { createSubmissionInput } from "../types";
import { Connection, Keypair, PublicKey, sendAndConfirmTransaction, SystemProgram, Transaction } from "@solana/web3.js";
import { PRIVATE_WALLET_KEY, PUBLIC_WALLET_ADDRESS } from "../util";
import decode from "bs58"
import nacl from "tweetnacl";
// import { createTaskInput } from "../types";

const TOTAL_SUBMISSION = 100;

const prismaClient = new PrismaClient();

const connection = new Connection("https://solana-devnet.g.alchemy.com/v2/AST8vSberMaE6RY3opJKTHnaKib_YBHD")

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

router.post("/payout", workerMiddleware, async (req, res) => {
    try {
        //@ts-ignore
        const workerId = req.userId

        const worker = await prismaClient.worker.findFirst({
            where: { id: Number(workerId) }
        })


        if (!worker) {
            return res.status(404).json({
                message: "Worker not found"
            })
        }

        const address = worker?.address;


        console.log({ PRIVATE_WALLET_KEY, address })
        const transaction = new Transaction().add(
            SystemProgram.transfer({
                fromPubkey: new PublicKey(PUBLIC_WALLET_ADDRESS),
                toPubkey: new PublicKey(address),
                lamports: 1000_000_000 * worker.pending_amount / TOTAL_DECIMALS
            })
        )

        const keypair = Keypair.fromSecretKey(decode.decode(PRIVATE_WALLET_KEY));

        const signature = await connection.sendTransaction(
            transaction, [keypair]
        )


        //We a lock should be here
        await prismaClient.$transaction(async tx => {
            await tx.worker.update({
                where: {
                    id: Number(workerId)
                },
                data: {
                    pending_amount: {
                        decrement: worker.pending_amount
                    },
                    locked_amount: {
                        increment: worker.pending_amount
                    }
                }
            })


            if (!worker) {
                throw new Error("Worker does not exist, cannot create payout.");
            }

            console.log({ workerId })
            await tx.payouts.create({
                data: {
                    worker_id: worker.id,
                    amount: worker.pending_amount,
                    status: "Processing",
                    signature
                }
            })
        })

        res.json({
            message: `${worker!.pending_amount / TOTAL_DECIMALS} Amount sent, You will recieve it in few seconds`,
            amount: worker.pending_amount
        })
    } catch (err) {
        console.log({ err })
        res.status(500).json({ message: "Transaction failed" })
    }
    
})

router.get("/balance", workerMiddleware, async (req, res) => {
    try {
        // @ts-ignore
        const userId: string = req

        const worker = await prismaClient.worker.findFirst({
            where: {
                id: Number(userId)
            }
        })

        res.json({
            pendingAmount: worker!.pending_amount / TOTAL_DECIMALS,
            lockedAmount: worker?.locked_amount
        });
    } catch (error) {
        res.status(500).json({ message: "Balance failed to fetch" })
    }
})

router.post("/submission", workerMiddleware, async (req, res) => {
    try {
        // @ts-ignore
        const userId = req.userId
        const body = req.body;
        const parsedBody = createSubmissionInput.safeParse(body);

        if (parsedBody.success) {
            const task = await getNextTask(Number(userId));
            if (!task || task?.id !== Number(parsedBody.data.taskId)) {
                return res.status(411).json({
                    message: "Incorrect task id"
                })
            }

            const amount = Number((task.amount / TOTAL_SUBMISSION).toString());
            const submission = await prismaClient.$transaction(async tx => {
                const submission = await tx.submission.create({
                    data: {
                        option_id: Number(parsedBody.data.selection),
                        worker_id: userId,
                        task_id: Number(parsedBody.data.taskId),
                        amount,
                    }
                })

                const worker = await tx.worker.update({
                    where: {
                        id: userId
                    },
                    data: {
                        pending_amount: {
                            increment: Number(amount)
                        }
                    }
                })
                return worker;
            })

            const nextTask = await getNextTask(Number(userId));

            console.log({ nextTask })

            res.json({
                nextTask,
                amount,
                balance: submission.pending_amount / TOTAL_DECIMALS
            })

        } else {
            res.status(400).json({
                message: "Incorrect inputs",
            })
        }
    } catch (error) {
        res.status(500).json({ message: "Failed to Submit, retry" })
    }
})


router.get("/nextTask", workerMiddleware, async (req, res) => {
    try {
        // @ts-ignore
        const userId = req.userId

        const task = await getNextTask(Number(userId))

        if (!task) {
            res.json({
                message: "No more tasks left for you to review"
            })
        } else {
            res.json({
                task
            })
        }
    } catch (error) {
        res.status(500).json({
            message: "An Error Occurred"
        })
    }
})

// signup with username, password
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

        const existingUser = await prismaClient.worker.findFirst({
            where: {
                address: publicKey
            }
        })

        if (existingUser) {
            const token = jwt.sign({
                userId: existingUser.id
            }, WORKER_JWT_SECRET)

            res.json({
                token,
                amount: existingUser.pending_amount / TOTAL_DECIMALS
            })

        } else {
            const user = await prismaClient.worker.create({
                data: {
                    address: publicKey,
                    pending_amount: 0,
                    locked_amount: 0
                }
            })

            const token = jwt.sign({
                userId: user.id
            }, WORKER_JWT_SECRET)

            res.json({
                token,
                amount: 0
            })
        }
    } catch (error) {
        res.status(500).json({
            message: "An Error Occurred"
        })
    }
})

export default router;