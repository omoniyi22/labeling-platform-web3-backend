import env from "dotenv"
env.config()

export const PUBLIC_WALLET_ADDRESS: any = process.env.PUBLIC_WALLET_ADDRESS
export const PRIVATE_WALLET_KEY: any = process.env.PRIVATE_WALLET_KEY
export const DEFAULT_TITLE: any = process.env.DEFAULT_TITLE
