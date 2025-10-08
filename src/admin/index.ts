import BlingSettingsPage, { config as blingSettingsConfig } from "./settings/bling-settings";
import BlingSettingsRoute, {
  config as blingSettingsRouteConfig,
} from "./routes/settings/bling/page";
import widgetExtensions from "./widgets";

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

export const widgets = widgetExtensions;

const entry = {
  identifier: "medusa-plugin-bling",
  routes,
  settings,
  widgets,
};

export default entry;
