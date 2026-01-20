/*
  Warnings:

  - Added the required column `mapId` to the `Space` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Space" ADD COLUMN     "mapId" TEXT NOT NULL;
