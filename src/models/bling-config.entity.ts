import {
  BaseEntity,
  BeforeInsert,
  Column,
  Entity,
  PrimaryColumn,
} from "typeorm"

export interface SyncPreferences {
  products: {
    enabled: boolean
    import_images: boolean
    import_descriptions: boolean
    import_prices: boolean
  }
  inventory: {
    enabled: boolean
    bidirectional: boolean
    locations: InventoryLocationMapping[]
  }
  orders: {
    enabled: boolean
    send_to_bling: boolean
    receive_from_bling: boolean
    generate_nf: boolean
  }
}

export interface InventoryLocationMapping {
  stock_location_id: string
  bling_deposit_id: string
  is_default?: boolean
}

@Entity({ name: "bling_config" })
export class BlingConfig extends BaseEntity {
  @PrimaryColumn({ type: "varchar", length: 64 })
  id!: string;

  @Column({ type: "varchar", nullable: true })
  client_id: string | null = null;

  @Column({ type: "varchar", nullable: true })
  client_secret: string | null = null;

  @Column({ type: "varchar", nullable: true })
  access_token: string | null = null;

  @Column({ type: "varchar", nullable: true })
  webhook_secret: string | null = null;

  @Column({ type: "varchar", nullable: true })
  refresh_token: string | null = null;

  @Column({ type: "int", nullable: true })
  expires_in: number | null = null;

  @Column({ type: "timestamp with time zone", nullable: true })
  token_updated_at: Date | null = null;

  @Column({ type: "jsonb", nullable: true })
  sync_preferences: SyncPreferences | null = null;

  @BeforeInsert()
  private beforeInsert(): void {
    this.id = "bling_config";
  }
}
