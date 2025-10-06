import { BlingToken } from "./models/bling-token.entity";
import BlingService from "./modules/bling.service";
import { CreateBlingTokenTable1728288000000 } from "./migrations/CreateBlingTokenTable";

export default {
  services: [BlingService],
  models: [BlingToken],
  migrations: [CreateBlingTokenTable1728288000000],
};