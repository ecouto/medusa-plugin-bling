import { Migration } from "@mikro-orm/migrations";

export class CreateBlingConfigTable1728288000001 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      create table if not exists "bling_config" (
        "id" text not null primary key,
        "client_id" text null,
        "client_secret" text null,
        "access_token" text null,
        "webhook_secret" text null,
        "refresh_token" text null,
        "expires_in" integer null,
        "token_updated_at" timestamptz null,
        "sync_preferences" jsonb null
      );
    `);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "bling_config" cascade;`);
  }
}
