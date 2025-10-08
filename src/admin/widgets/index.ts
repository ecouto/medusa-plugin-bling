import type { ComponentType } from "react";
import type { WidgetConfig } from "@medusajs/admin-sdk";

export type WidgetExtension = {
  Component: ComponentType;
  config: WidgetConfig;
};

export const widgets: WidgetExtension[] = [];
