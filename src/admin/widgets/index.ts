import type { JSX } from "react"

export type WidgetComponent = () => JSX.Element

export const widgets: WidgetComponent[] = []

const widgetModule = {
  widgets,
}

export default widgetModule
