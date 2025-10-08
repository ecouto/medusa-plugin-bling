import type { ComponentType } from "react";

declare module "@medusajs/admin-sdk" {
  export type SettingsCardConfig = {
    card: {
      label: string;
      description?: string;
      icon?: ComponentType;
    };
    path?: string;
  };

  export function defineSettingsConfig<T extends SettingsCardConfig>(config: T): T;
}
