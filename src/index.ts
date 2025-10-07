import BlingService from "./modules/bling.service"
import { BlingConfig } from "./models/bling-config.entity"
import { CreateBlingConfigTable1728288000001 } from "./migrations/CreateBlingConfigTable"
import register from "./loaders/register"

export default {
  loaders: [register],
  services: [BlingService],
  models: [BlingConfig],
  migrations: [CreateBlingConfigTable1728288000001],
}
