-- CreateEnum
CREATE TYPE "role" AS ENUM ('MEMBER', 'MANAGER');

-- CreateEnum
CREATE TYPE "ticket_status" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "ticket_priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "service_status" AS ENUM ('OPERATIONAL', 'DEGRADED', 'OUTAGE');

-- CreateEnum
CREATE TYPE "incident_status" AS ENUM ('INVESTIGATING', 'IDENTIFIED', 'MONITORING', 'RESOLVED');

-- CreateEnum
CREATE TYPE "incident_severity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "activity_action" AS ENUM ('TICKET_CREATED', 'TICKET_ASSIGNED', 'TICKET_STATUS_CHANGED', 'TICKET_PRIORITY_CHANGED', 'SERVICE_STATUS_CHANGED', 'INCIDENT_CREATED', 'INCIDENT_STATUS_CHANGED', 'INCIDENT_SEVERITY_CHANGED', 'INCIDENT_SERVICE_LINKED', 'INCIDENT_SERVICE_UNLINKED', 'INCIDENT_TICKET_LINKED', 'INCIDENT_TICKET_UNLINKED', 'INCIDENT_RESOLVED');

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "role" NOT NULL DEFAULT 'MEMBER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "ticket_status" NOT NULL DEFAULT 'OPEN',
    "priority" "ticket_priority" NOT NULL DEFAULT 'MEDIUM',
    "assignee_id" UUID,
    "creator_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "service_status" NOT NULL DEFAULT 'OPERATIONAL',
    "latency_ms" INTEGER NOT NULL DEFAULT 0,
    "error_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incidents" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "incident_status" NOT NULL DEFAULT 'INVESTIGATING',
    "severity" "incident_severity" NOT NULL DEFAULT 'MEDIUM',
    "responder_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident_services" (
    "incident_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "org_id" UUID NOT NULL,

    CONSTRAINT "incident_services_pkey" PRIMARY KEY ("incident_id","service_id")
);

-- CreateTable
CREATE TABLE "incident_tickets" (
    "incident_id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "linked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unlinked_at" TIMESTAMP(3),

    CONSTRAINT "incident_tickets_pkey" PRIMARY KEY ("incident_id","ticket_id")
);

-- CreateTable
CREATE TABLE "activities" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "actor_id" UUID,
    "action" "activity_action" NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" UUID NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "users_org_id_idx" ON "users"("org_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_org_id_email_key" ON "users"("org_id", "email");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "tickets_org_id_idx" ON "tickets"("org_id");

-- CreateIndex
CREATE INDEX "tickets_org_id_status_idx" ON "tickets"("org_id", "status");

-- CreateIndex
CREATE INDEX "tickets_assignee_id_idx" ON "tickets"("assignee_id");

-- CreateIndex
CREATE INDEX "services_org_id_idx" ON "services"("org_id");

-- CreateIndex
CREATE INDEX "services_org_id_status_idx" ON "services"("org_id", "status");

-- CreateIndex
CREATE INDEX "incidents_org_id_idx" ON "incidents"("org_id");

-- CreateIndex
CREATE INDEX "incidents_org_id_status_idx" ON "incidents"("org_id", "status");

-- CreateIndex
CREATE INDEX "incident_services_service_id_idx" ON "incident_services"("service_id");

-- CreateIndex
CREATE INDEX "incident_services_org_id_idx" ON "incident_services"("org_id");

-- CreateIndex
CREATE INDEX "incident_tickets_ticket_id_idx" ON "incident_tickets"("ticket_id");

-- CreateIndex
CREATE INDEX "incident_tickets_org_id_idx" ON "incident_tickets"("org_id");

-- CreateIndex
CREATE UNIQUE INDEX "one_active_incident_per_ticket" ON "incident_tickets"("ticket_id") WHERE ("is_active" = true);

-- CreateIndex
CREATE INDEX "activities_org_id_created_at_idx" ON "activities"("org_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_responder_id_fkey" FOREIGN KEY ("responder_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_services" ADD CONSTRAINT "incident_services_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_services" ADD CONSTRAINT "incident_services_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_services" ADD CONSTRAINT "incident_services_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_tickets" ADD CONSTRAINT "incident_tickets_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_tickets" ADD CONSTRAINT "incident_tickets_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_tickets" ADD CONSTRAINT "incident_tickets_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
