import { SettingsCard } from "@medusajs/admin-ui";
import { GearSix } from "@medusajs/icons";

const BlingSettings = () => {
  return (
    <SettingsCard
      title="Bling ERP"
      description="Gerencie a configuracao da sua integracao com o Bling ERP."
      icon={<GearSix />}
      to="/a/settings/bling"
    />
  );
};

export const settings = {
    card: BlingSettings,
};