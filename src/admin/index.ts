import BlingSettingsPage, { config as blingSettingsConfig } from "./settings/bling-settings";
import BlingSettingsRoute, { config as blingSettingsRouteConfig } from "./routes/settings/bling/page";
import { widgets } from "./widgets";

const settingsPath = blingSettingsConfig.path ?? "/settings/bling";

export const widgetModule = {
  widgets,
};

export const routeModule = {
  routes: [
    {
      Component: BlingSettingsRoute,
      path: settingsPath,
    },
  ],
};

export const menuItemModule = {
  menuItems: [
    {
      label: blingSettingsConfig.card.label,
      description: blingSettingsConfig.card.description,
      icon: blingSettingsConfig.card.icon ?? blingSettingsRouteConfig.icon,
      path: settingsPath,
      nested: blingSettingsRouteConfig.nested,
    },
  ],
};

export const settingsModule = {
  settings: [
    {
      Component: BlingSettingsPage,
      config: blingSettingsConfig,
    },
  ],
};

const plugin = {
  id: "medusa-plugin-bling",
  widgetModule,
  routeModule,
  menuItemModule,
  settingsModule,
};

export default plugin;
