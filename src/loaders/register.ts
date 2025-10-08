import type { IOrderModuleService, Logger, MedusaContainer } from "@medusajs/types";
import type { IEventBusService } from "@medusajs/types/dist/event-bus/event-bus";
import { asValue } from "awilix";
import { BLING_MODULE } from "../modules/bling";
import type { BlingModuleService } from "../modules/bling";
import OrderSyncService from "../modules/order-sync.service";

type RegisterArgs = {
  container: MedusaContainer;
  options?: Record<string, unknown>;
};

const register = async ({ container }: RegisterArgs): Promise<void> => {
  const logger = container.resolve<Logger>("logger");

  type ContainerWithRegistry = MedusaContainer & {
    hasRegistration?: (key: string) => boolean;
  };

  const scopedContainer = container as ContainerWithRegistry;

  let orderModuleService: IOrderModuleService | undefined;
  if (typeof scopedContainer.hasRegistration === "function") {
    if (scopedContainer.hasRegistration("orderModuleService")) {
      orderModuleService = container.resolve<IOrderModuleService>("orderModuleService");
    }
  }

  const blingService = container.resolve<BlingModuleService>(BLING_MODULE);
  const orderSyncService = new OrderSyncService({
    logger,
    orderModuleService,
    blingService,
  });
  if (scopedContainer.hasRegistration?.("eventBusService")) {
    const eventBus = container.resolve<IEventBusService>("eventBusService");
    const subscribe = (eventName: string) => {
      eventBus.subscribe(
        eventName,
        async ({ data }) => {
          type OrderEventPayload = {
            id?: string;
            order_id?: string;
            ids?: string[];
          };
          const payload = data as OrderEventPayload;
          const orderId =
            payload.id ??
            payload.order_id ??
            (Array.isArray(payload.ids) ? payload.ids[0] : undefined);
          if (!orderId) {
            logger.warn(
              `[bling] Evento ${eventName} recebido sem ID de pedido. Payload: ${JSON.stringify(
                data
              )}`
            );
            return;
          }

          try {
            await orderSyncService.syncOrder(orderId as string, {
              generateNfe: blingService.mergePreferences(
                {},
                (await blingService.getBlingConfig())?.syncPreferences ?? undefined
              ).orders.generate_nf,
            });
          } catch (error) {
            logger.error(
              `[bling] Falha ao sincronizar pedido ${orderId} para o Bling após evento ${eventName}: ${
                (error as Error).message
              }`
            );
          }
        },
        { subscriberId: `bling-${eventName}-order-sync` }
      );
    };

    ["order.completed", "order.placed"].forEach(subscribe);
  }

  container.register({
    blingService: asValue(blingService),
    orderSyncService: asValue(orderSyncService),
  });
};

export default register;
