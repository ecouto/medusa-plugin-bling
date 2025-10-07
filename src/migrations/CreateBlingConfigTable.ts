import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateBlingConfigTable1728288000001 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "bling_config" (
                "id" character varying NOT NULL PRIMARY KEY,
                "client_id" character varying,
                "client_secret" character varying,
                "access_token" character varying,
                "webhook_secret" character varying,
                "refresh_token" character varying,
                "expires_in" integer,
                "token_updated_at" TIMESTAMP WITH TIME ZONE,
                "sync_preferences" jsonb
            );
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "bling_config";`);
    }
}
