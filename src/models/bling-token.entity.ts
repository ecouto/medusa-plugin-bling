import { BaseEntity } from "@medusajs/medusa"
import { Entity, Column, PrimaryColumn } from "typeorm"

@Entity()
export class BlingToken extends BaseEntity {
  @PrimaryColumn()
  id: string; // Should be a constant, e.g., 'bling_token'

  @Column({ type: "varchar", nullable: false })
  access_token: string;

  @Column({ type: "varchar", nullable: false })
  refresh_token: string;

  @Column({ type: "int", nullable: false })
  expires_in: number;

  @Column({ type: "timestamp with time zone", nullable: false })
  updated_at: Date;
}
