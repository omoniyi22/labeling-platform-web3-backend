import { Prisma, PrismaClient } from "@prisma/client";
const prismaClient = new PrismaClient();


export const getNextTask = async (userId: number) => {
    const task = await prismaClient.task.findFirst({
        where: {
            done: false,
            submissions: {
                none: {
                    worker_id: userId, 
                }
            }
        },
        select: {
            title: true,
            options: true,
            id: true,
            amount: true
        }
    })
    return task
}