import type { ComponentType } from "react";
import BlingSettingsPage from "../routes/settings/bling/page";

type SettingCardConfig = {
  label: string;
  description?: string;
  icon?: ComponentType;
};

type SettingsConfig = {
  /**
   * Relative route path under /a
   */
  path: string;
  card: SettingCardConfig;
};

export const config: SettingsConfig = {
  path: "/settings/bling",
  card: {
    label: "Bling ERP",
    description: "Configure credenciais, sincronização e pedidos da integração com o Bling ERP.",
  },
};

export default BlingSettingsPage;
