import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateBlingTokenTable1728288000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "bling_token" (
                "id" character varying NOT NULL PRIMARY KEY,
                "access_token" character varying NOT NULL,
                "refresh_token" character varying NOT NULL,
                "expires_in" integer NOT NULL,
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
            );
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "bling_token";`);
    }
}
