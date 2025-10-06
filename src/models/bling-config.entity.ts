import { BaseEntity } from "@medusajs/medusa"
import { BeforeInsert, Column, Entity } from "typeorm"

@Entity()
export class BlingConfig extends BaseEntity {
  @Column({ type: "varchar", primary: true })
  id: string;

  @Column({ type: "varchar", nullable: true })
  client_id: string;

  @Column({ type: "varchar", nullable: true })
  client_secret: string;

  @Column({ type: "varchar", nullable: true })
  access_token: string;

  @Column({ type: "varchar", nullable: true })
  refresh_token: string;

  @Column({ type: "int", nullable: true })
  expires_in: number;

  @Column({ type: "timestamp with time zone", nullable: true })
  token_updated_at: Date;

  @BeforeInsert()
  private beforeInsert(): void {
    this.id = "bling_config";
  }
}
