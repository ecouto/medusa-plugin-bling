import BlingSettingsPage, {
  config as blingSettingsConfig,
} from "./settings/bling-settings"

export const widgets: (() => JSX.Element)[] = []

const entry = {
  identifier: "medusa-plugin-bling",
  extensions: [
    {
      Component: BlingSettingsPage,
      config: { ...blingSettingsConfig, type: "setting" as const },
    },
  ],
  widgets,
}

export default entry
