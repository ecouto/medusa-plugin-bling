import BlingSettingsPage, {
  config as blingSettingsConfig,
} from "./settings/bling-settings"

const entry = {
  identifier: "medusa-plugin-bling",
  extensions: [
    {
      Component: BlingSettingsPage,
      config: { ...blingSettingsConfig, type: "setting" as const },
    },
  ],
}

export default entry
