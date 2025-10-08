import type { ComponentType } from "react";
import * as adminSdk from "@medusajs/admin-sdk";

type SettingsCardConfig = {
  card: {
    label: string;
    description?: string;
    icon?: ComponentType;
  };
  path?: string;
};

type AdminSdkWithSettings = typeof adminSdk & {
  defineSettingsConfig?: <T extends SettingsCardConfig>(config: T) => T;
};

const sdk = adminSdk as AdminSdkWithSettings;

if (typeof sdk.defineSettingsConfig !== "function") {
  sdk.defineSettingsConfig = <T extends SettingsCardConfig>(config: T): T => ({
    ...config,
    $$typeof: Symbol.for("react.memo"),
  });
}

export {};
