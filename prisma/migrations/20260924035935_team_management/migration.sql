-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "activity_action" ADD VALUE 'MEMBER_INVITED';
ALTER TYPE "activity_action" ADD VALUE 'MEMBER_JOINED';
ALTER TYPE "activity_action" ADD VALUE 'MEMBER_ROLE_CHANGED';
ALTER TYPE "activity_action" ADD VALUE 'MEMBER_DEACTIVATED';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "invitations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "role" NOT NULL DEFAULT 'MEMBER',
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "invited_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invitations_token_hash_key" ON "invitations"("token_hash");

-- CreateIndex
CREATE INDEX "invitations_org_id_idx" ON "invitations"("org_id");

-- CreateIndex
CREATE INDEX "invitations_org_id_email_idx" ON "invitations"("org_id", "email");

-- CreateIndex
CREATE INDEX "invitations_invited_by_id_idx" ON "invitations"("invited_by_id");

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_id_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
