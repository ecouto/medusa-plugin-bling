import { BaseEntity } from "@medusajs/medusa"
import { BeforeInsert, Column, Entity } from "typeorm"

@Entity()
export class BlingConfig extends BaseEntity {
  @Column({ type: "varchar", primary: true })
  id: string = "bling_config";

  @Column({ type: "varchar", nullable: true })
  client_id: string | null = null;

  @Column({ type: "varchar", nullable: true })
  client_secret: string | null = null;

  @Column({ type: "varchar", nullable: true })
  access_token: string | null = null;

  @Column({ type: "varchar", nullable: true })
  refresh_token: string | null = null;

  @Column({ type: "int", nullable: true })
  expires_in: number | null = null;

  @Column({ type: "timestamp with time zone", nullable: true })
  token_updated_at: Date | null = null;

  @BeforeInsert()
  private beforeInsert(): void {
    this.id = "bling_config";
  }
}
