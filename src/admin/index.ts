import BlingSettingsPage, { config as blingSettingsConfig } from "./settings/bling-settings"
import { widgets } from "./widgets"

export { widgets } from "./widgets"

export const routes: never[] = []
export const settings = [
  {
    Component: BlingSettingsPage,
    config: { ...blingSettingsConfig },
  },
]

const entry = {
  identifier: "medusa-plugin-bling",
  extensions: [
    {
      Component: BlingSettingsPage,
      config: { ...blingSettingsConfig, type: "setting" as const },
    },
    ],
    widgets,
    routes,
    settings,
}

export default entry
