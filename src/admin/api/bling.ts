import { request } from "./client";

export type InventoryLocationMappingForm = {
  stock_location_id: string;
  bling_deposit_id: string;
  is_default?: boolean;
};

export type StockLocationOption = {
  id: string;
  name: string;
};

export type SyncPreferencesForm = {
  products: {
    enabled: boolean;
    import_images: boolean;
    import_descriptions: boolean;
    import_prices: boolean;
  };
  inventory: {
    enabled: boolean;
    bidirectional: boolean;
    locations: InventoryLocationMappingForm[];
  };
  orders: {
    enabled: boolean;
    send_to_bling: boolean;
    receive_from_bling: boolean;
    generate_nf: boolean;
  };
};

export type BlingConfigResponse = {
  client_id: string;
  client_secret: string;
  webhook_secret: string;
  is_connected: boolean;
  sync_preferences: SyncPreferencesForm;
};

export type UpdateBlingConfigRequest = {
  client_id: string;
  client_secret: string;
  webhook_secret: string;
  sync_preferences: SyncPreferencesForm;
};

export type BlingHealthResponse = {
  status: "ok" | "not_connected" | "error" | string;
  message?: string;
};

export type ProductSyncSummary = {
  total_products: number;
  total_variants: number;
  products_with_inventory_data: number;
  created: number;
  updated: number;
  skipped: number;
  preview: Array<{
    external_id: string;
    name: string;
    variants: number;
    stock_entries: number;
  }>;
};

export type ProductSyncResponse = {
  message: string;
  summary: ProductSyncSummary;
  warnings?: string[];
};

export type OrderSyncResultResponse = {
  summary: {
    total_items: number;
    total_amount: number;
    freight_amount: number;
    bling_sale_id: string | null;
    synced_at: string;
  };
  warnings: string[];
};

export type OrderSyncResponse = {
  message: string;
  result: OrderSyncResultResponse;
};

export const blingApi = {
  getConfig: () => request<BlingConfigResponse>("/admin/bling/config"),
  saveConfig: (payload: UpdateBlingConfigRequest) =>
    request<{ message: string }>("/admin/bling/config", {
      method: "POST",
      json: true,
      body: payload,
    }),
  getInventoryLocations: () =>
    request<{
      locations: StockLocationOption[];
      mappings: InventoryLocationMappingForm[];
    }>("/admin/bling/inventory/locations"),
  getHealth: () => request<BlingHealthResponse>("/admin/bling/health"),
  syncProducts: () =>
    request<ProductSyncResponse>("/admin/bling/sync", {
      method: "POST",
      json: true,
      body: {},
    }),
  syncOrder: (
    orderId: string,
    payload: { generateNfe?: boolean; generateShippingLabel?: boolean }
  ) =>
    request<OrderSyncResponse>(`/admin/bling/orders/${orderId}/sync`, {
      method: "POST",
      json: true,
      body: payload,
    }),
};

export { ApiError } from "./client";
