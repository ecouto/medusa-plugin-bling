import { defineModule } from "@medusajs/framework/utils"
import BlingService from "./services/bling"

export * from "./services"
export * from "./types"
export * from "./utils"

export default defineModule("blingService", {
  service: BlingService
})