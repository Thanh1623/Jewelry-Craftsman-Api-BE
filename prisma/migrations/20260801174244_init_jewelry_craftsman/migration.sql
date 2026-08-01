/*
  Warnings:

  - You are about to drop the `board_members` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `boards` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `cards` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `lists` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "request_status" AS ENUM ('PENDING', 'ANSWERED');

-- DropForeignKey
ALTER TABLE "board_members" DROP CONSTRAINT "board_members_board_id_fkey";

-- DropForeignKey
ALTER TABLE "board_members" DROP CONSTRAINT "board_members_user_id_fkey";

-- DropForeignKey
ALTER TABLE "boards" DROP CONSTRAINT "boards_owner_id_fkey";

-- DropForeignKey
ALTER TABLE "cards" DROP CONSTRAINT "cards_list_id_fkey";

-- DropForeignKey
ALTER TABLE "lists" DROP CONSTRAINT "lists_board_id_fkey";

-- DropTable
DROP TABLE "board_members";

-- DropTable
DROP TABLE "boards";

-- DropTable
DROP TABLE "cards";

-- DropTable
DROP TABLE "lists";

-- DropEnum
DROP TYPE "board_role";

-- CreateTable
CREATE TABLE "craftsman_requests" (
    "id" UUID NOT NULL,
    "shop_request_id" TEXT NOT NULL,
    "chat_session_id" TEXT NOT NULL,
    "product_id" TEXT,
    "product_name" TEXT NOT NULL,
    "product_weight_grams" DOUBLE PRECISION NOT NULL,
    "product_labor_cost" INTEGER NOT NULL,
    "product_base_size" INTEGER,
    "question" TEXT NOT NULL,
    "customer_note" TEXT,
    "reply_webhook_url" TEXT NOT NULL,
    "status" "request_status" NOT NULL DEFAULT 'PENDING',
    "answer" TEXT,
    "answered_by_id" UUID,
    "answered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "craftsman_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "craftsman_requests_shop_request_id_key" ON "craftsman_requests"("shop_request_id");

-- CreateIndex
CREATE INDEX "craftsman_requests_status_created_at_idx" ON "craftsman_requests"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- CreateIndex
CREATE INDEX "push_subscriptions_user_id_idx" ON "push_subscriptions"("user_id");

-- AddForeignKey
ALTER TABLE "craftsman_requests" ADD CONSTRAINT "craftsman_requests_answered_by_id_fkey" FOREIGN KEY ("answered_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
