import { Module } from "@medusajs/framework/utils";
import BlingModuleService from "./service";

export const BLING_MODULE = "bling";

const blingModule = Module(BLING_MODULE, {
  service: BlingModuleService,
});

export default blingModule;

export { BlingModuleService };
export type { BlingModuleOptions } from "./service";
