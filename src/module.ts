import { Module } from "@medusajs/framework/utils"
import BlingService from "./services/bling"

export const BLING_MODULE = "blingService"

export default Module(BLING_MODULE, {
  service: BlingService
}) 