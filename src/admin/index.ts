import BlingSettingsPage, { config as blingSettingsConfig } from "./settings/bling-settings";
import BlingSettingsRoute, { config as blingSettingsRouteConfig } from "./routes/settings/bling/page";
import { widgets } from "./widgets";

export const routes = [
  {
    Component: BlingSettingsRoute,
    config: blingSettingsRouteConfig,
  },
];

export const settings = [
  {
    Component: BlingSettingsPage,
    config: blingSettingsConfig,
  },
];

export { widgets };

const entry = {
  identifier: "medusa-plugin-bling",
  routes,
  settings,
  widgets,
};

export default entry;
