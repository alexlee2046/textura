-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "credits" INTEGER NOT NULL DEFAULT 20,
ADD COLUMN     "plan" TEXT NOT NULL DEFAULT 'free';

-- AlterTable
ALTER TABLE "generations" ADD COLUMN     "group_id" TEXT,
ADD COLUMN     "mode" TEXT,
ADD COLUMN     "scene_params" JSONB;

-- CreateTable
CREATE TABLE "transactions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "user_id" UUID,
    "type" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "description" TEXT,
    "payment_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "model_3d_generations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID,
    "user_id" UUID NOT NULL,
    "mode" TEXT NOT NULL,
    "furniture_type" TEXT NOT NULL,
    "dimensions" JSONB NOT NULL,
    "credit_cost" INTEGER NOT NULL,
    "input_image_url" TEXT NOT NULL,
    "enhanced_image_url" TEXT,
    "enhanced_image_2_url" TEXT,
    "enhance_count" INTEGER NOT NULL DEFAULT 0,
    "feedback" TEXT,
    "tripo_task_id" TEXT,
    "tripo_result_url" TEXT,
    "tripo_expires_at" TIMESTAMP(3),
    "model_url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'enhancing',
    "idempotency_key" TEXT,
    "share_hash" TEXT,
    "submitted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "model_3d_generations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_tx_org" ON "transactions"("organization_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "model_3d_generations_tripo_task_id_key" ON "model_3d_generations"("tripo_task_id");

-- CreateIndex
CREATE UNIQUE INDEX "model_3d_generations_idempotency_key_key" ON "model_3d_generations"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "model_3d_generations_share_hash_key" ON "model_3d_generations"("share_hash");

-- CreateIndex
CREATE INDEX "idx_m3d_user" ON "model_3d_generations"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_m3d_org" ON "model_3d_generations"("organization_id");

-- CreateIndex
CREATE INDEX "idx_m3d_status" ON "model_3d_generations"("status");

-- CreateIndex
CREATE INDEX "idx_m3d_share" ON "model_3d_generations"("share_hash");

-- CreateIndex
CREATE INDEX "idx_gen_group" ON "generations"("group_id");

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "model_3d_generations" ADD CONSTRAINT "model_3d_generations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
