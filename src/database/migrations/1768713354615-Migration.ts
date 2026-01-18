import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1768713354615 implements MigrationInterface {
    name = 'Migration1768713354615'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "luca"."GOV_SYNC_JOB_STATUS" AS ENUM('QUEUED', 'RUNNING', 'WAITING_EXTERNAL', 'PARTIALLY_COMPLETED', 'COMPLETED', 'FAILED')`);
        await queryRunner.query(`CREATE TABLE "gov_sync_jobs" ("id" SERIAL NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "tenant_id" integer NOT NULL, "period_id" character varying(32) NOT NULL, "window_start" date NOT NULL, "window_end" date NOT NULL, "status" "luca"."GOV_SYNC_JOB_STATUS" NOT NULL, "scheduled_at" TIMESTAMP WITH TIME ZONE NOT NULL, "started_at" TIMESTAMP WITH TIME ZONE, "completed_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_cdc643e2fec81854eb81ef8af50" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "ix_gov_sync_jobs_tenant_status_scheduled" ON "gov_sync_jobs" ("tenant_id", "status", "scheduled_at") `);
        await queryRunner.query(`CREATE TYPE "luca"."GOV_SYNC_RESULT_STATUS" AS ENUM('ACCEPTED', 'REJECTED', 'CORRECTED', 'ERROR', 'DEAD', 'WAITING_EXTERNAL')`);
        await queryRunner.query(`CREATE TABLE "gov_sync_results" ("id" SERIAL NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "job_id" integer NOT NULL, "tenant_id" integer NOT NULL, "student_id" uuid NOT NULL, "period_id" character varying(32) NOT NULL, "status" "luca"."GOV_SYNC_RESULT_STATUS" NOT NULL, "attempt_number" integer NOT NULL DEFAULT '1', "external_record_id" character varying(128), "idempotency_key" character varying(128) NOT NULL, "error_code" character varying(64), "error_message" text, "raw_request" jsonb, "raw_response" jsonb, "synced_at" TIMESTAMP WITH TIME ZONE, "next_retry_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "ux_gov_sync_results_tenant_idempotency" UNIQUE ("tenant_id", "idempotency_key"), CONSTRAINT "PK_07765c3cf3c2317896a64cf3d00" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "ix_gov_sync_results_job_status" ON "gov_sync_results" ("job_id", "status") `);
        await queryRunner.query(`ALTER TABLE "gov_sync_results" ADD CONSTRAINT "FK_2ab731ae3e5a0a990f51b449314" FOREIGN KEY ("job_id") REFERENCES "gov_sync_jobs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "gov_sync_results" DROP CONSTRAINT "FK_2ab731ae3e5a0a990f51b449314"`);
        await queryRunner.query(`DROP INDEX "luca"."ix_gov_sync_results_job_status"`);
        await queryRunner.query(`DROP TABLE "gov_sync_results"`);
        await queryRunner.query(`DROP TYPE "luca"."GOV_SYNC_RESULT_STATUS"`);
        await queryRunner.query(`DROP INDEX "luca"."ix_gov_sync_jobs_tenant_status_scheduled"`);
        await queryRunner.query(`DROP TABLE "gov_sync_jobs"`);
        await queryRunner.query(`DROP TYPE "luca"."GOV_SYNC_JOB_STATUS"`);
    }

}
