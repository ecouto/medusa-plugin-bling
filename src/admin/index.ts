import BlingSettingsPage, { config as blingSettingsConfig } from "./settings/bling-settings";
import BlingSettingsRoute, {
  config as blingSettingsRouteConfig,
} from "./routes/settings/bling/page";
import widgetModule from "./widgets";

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

export const widgets = widgetModule.widgets;

const entry = {
  identifier: "medusa-plugin-bling",
  extensions: {
    routes,
    settings,
    widgets,
  },
};

export default entry;
