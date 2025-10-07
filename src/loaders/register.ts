import type {
  IOrderModuleService,
  IProductModuleService,
  Logger,
  MedusaContainer,
} from "@medusajs/types"
import type { IEventBusService } from "@medusajs/types/dist/event-bus/event-bus"
import { asValue } from "awilix"
import type { EntityManager } from "typeorm"
import { BlingConfig } from "../models/bling-config.entity"
import BlingService from "../modules/bling.service"
import OrderSyncService from "../modules/order-sync.service"

type RegisterArgs = {
  container: MedusaContainer
  options?: Record<string, unknown>
}

const register = async ({ container }: RegisterArgs): Promise<void> => {
  const manager = container.resolve<EntityManager>("manager")
  const logger = container.resolve<Logger>("logger")

  const blingConfigRepository = manager.getRepository(BlingConfig)

  let productModuleService: IProductModuleService | undefined
  let orderModuleService: IOrderModuleService | undefined
  if (typeof (container as any).hasRegistration === "function") {
    if ((container as any).hasRegistration("productModuleService")) {
      productModuleService = container.resolve<IProductModuleService>(
        "productModuleService"
      )
    }
    if ((container as any).hasRegistration("orderModuleService")) {
      orderModuleService = container.resolve<IOrderModuleService>(
        "orderModuleService"
      )
    }
  }

  const serviceDependencies: {
    blingConfigRepository: typeof blingConfigRepository
    logger: Logger
    productModuleService?: IProductModuleService | undefined
  } = {
    blingConfigRepository,
    logger,
  }

  if (productModuleService) {
    serviceDependencies.productModuleService = productModuleService
  }

  const blingService = new BlingService(serviceDependencies)
  const orderSyncService = new OrderSyncService({
    logger,
    orderModuleService,
    blingService,
  })
  if ((container as any).hasRegistration?.("eventBusService")) {
    const eventBus = container.resolve<IEventBusService>("eventBusService")
    const subscribe = (eventName: string) => {
      eventBus.subscribe(
        eventName,
        async ({ data }) => {
          const orderId =
            (data as any)?.id ??
            (data as any)?.order_id ??
            (Array.isArray((data as any)?.ids) ? (data as any).ids[0] : undefined)
          if (!orderId) {
            logger.warn(
              `[bling] Evento ${eventName} recebido sem ID de pedido. Payload: ${JSON.stringify(
                data
              )}`
            )
            return
          }

          try {
            await orderSyncService.syncOrder(orderId as string, {
              generateNfe: blingService
                .mergePreferences({}, (await blingService.getBlingConfig())?.sync_preferences ?? undefined)
                .orders.generate_nf,
            })
          } catch (error) {
            logger.error(
              `[bling] Falha ao sincronizar pedido ${orderId} para o Bling após evento ${eventName}: ${
                (error as Error).message
              }`
            )
          }
        },
        { subscriberId: `bling-${eventName}-order-sync` }
      )
    }

    ;["order.completed", "order.placed"].forEach(subscribe)
  }

  container.register({
    blingConfigRepository: asValue(blingConfigRepository),
    blingService: asValue(blingService),
    orderSyncService: asValue(orderSyncService),
  })
}

export default register
