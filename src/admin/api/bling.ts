import { request } from "./client";

export type BlingPreferences = {
  products: {
    syncCatalog: boolean;
    importImages: boolean;
    importDescriptions: boolean;
    importPrices: boolean;
  };
  inventory: {
    syncInventory: boolean;
  };
  orders: {
    sendToBling: boolean;
    receiveUpdates: boolean;
  };
};

export type BlingConfigResponse = {
  clientId: string | null;
  clientSecret: string | null;
  webhookSecret: string | null;
  preferences: BlingPreferences;
};

export type UpdateBlingConfigRequest = {
  clientId: string;
  clientSecret: string;
  webhookSecret: string;
  preferences: BlingPreferences;
};

export type BlingHealthResponse = {
  status: "ok" | "not_connected" | "error";
  message?: string;
  timestamp?: string;
};

export type SyncOrderRequest = Record<string, never>;

export type SyncOrderResponse = {
  success: boolean;
  message?: string;
  result: {
    summary: {
      bling_sale_id?: string;
      synced_at: string;
    };
  };
};

export const blingApi = {
  getConfig: () => request<BlingConfigResponse>("/admin/bling/config"),
  saveConfig: (payload: UpdateBlingConfigRequest) =>
    request<{ success: boolean; message: string }>("/admin/bling/config", {
      method: "POST",
      json: true,
      body: payload,
    }),
  getHealth: () => request<BlingHealthResponse>("/admin/bling/health"),
  syncOrder: (orderId: string, payload: SyncOrderRequest) =>
    request<SyncOrderResponse>(`/admin/bling/orders/${orderId}/sync`, {
      method: "POST",
      json: true,
      body: payload,
    }),
};

export { ApiError } from "./client";
