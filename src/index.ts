import blingModule from "./modules/bling";
import { CreateBlingConfigTable1728288000001 } from "./migrations/CreateBlingConfigTable";
import register from "./loaders/register";

export default {
  module: blingModule,
  loaders: [register],
  migrations: [CreateBlingConfigTable1728288000001],
};

export type { BlingModuleOptions } from "./modules/bling";
