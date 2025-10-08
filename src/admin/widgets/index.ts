import type { ComponentType } from "react";
import type { WidgetConfig } from "@medusajs/admin-sdk";
import OrderSyncWidget, { config as orderSyncWidgetConfig } from "./order-sync-widget";

export type WidgetExtension = {
  Component: ComponentType;
  config: WidgetConfig;
};

export const widgets: WidgetExtension[] = [
  {
    Component: OrderSyncWidget,
    config: orderSyncWidgetConfig,
  },
];
