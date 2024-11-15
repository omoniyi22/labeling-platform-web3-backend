/*
  Warnings:

  - Added the required column `amount` to the `Submission` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "amount" INTEGER NOT NULL;
