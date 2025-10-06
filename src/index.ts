import BlingService from "./modules/bling.service";
import { BlingConfig } from "./models/bling-config.entity";
import { CreateBlingConfigTable1728288000001 } from "./migrations/CreateBlingConfigTable";

export default {
  services: [BlingService],
  models: [BlingConfig],
  migrations: [CreateBlingConfigTable1728288000001],
};