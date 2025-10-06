import { BaseEntity } from "@medusajs/medusa"
import { BeforeInsert, Column, Entity } from "typeorm"
import { generateEntityId } from "@medusajs/utils"

@Entity()
export class BlingToken extends BaseEntity {
  // id is not primary, as we want a single row

  @Column({ type: "varchar", primary: true })
  id: string;

  @Column({ type: "varchar", nullable: false })
  access_token: string;

  @Column({ type: "varchar", nullable: false })
  refresh_token: string;

  @Column({ type: "int", nullable: false })
  expires_in: number;

  @Column({ type: "timestamp with time zone", nullable: false })
  updated_at: Date;

  @BeforeInsert()
  private beforeInsert(): void {
    if (!this.id) {
      this.id = "bling_token_id"; // Constant ID for single-row storage
    }
  }
}
