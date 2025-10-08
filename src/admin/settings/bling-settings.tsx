import "../utils/ensure-settings-config";
import { defineSettingsConfig } from "@medusajs/admin-sdk";
import BlingSettingsPage from "../routes/settings/bling/page";

export const config = defineSettingsConfig({
  path: "/settings/bling",
  card: {
    label: "Bling ERP",
    description: "Configure credenciais, sincronização e pedidos da integração com o Bling ERP.",
  },
});

export default BlingSettingsPage;
