import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/dist/http";
import { z } from "zod";
import { BLING_MODULE } from "../../../../modules/bling";
import type { BlingModuleService } from "../../../../modules/bling";
import type { BlingSyncPreferencesInput } from "../../../../modules/bling/service";

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const blingService = req.scope.resolve<BlingModuleService>(BLING_MODULE);
  const config = await blingService.getBlingConfig();
  const syncPreferences = blingService.mergePreferences({}, config?.syncPreferences ?? undefined);

  res.status(200).json({
    client_id: config?.clientId ?? "",
    client_secret: config?.clientSecret ?? "",
    webhook_secret: config?.webhookSecret ?? "",
    is_connected: Boolean(config?.accessToken),
    sync_preferences: syncPreferences,
  });
}

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const locationMappingSchema = z.object({
    stock_location_id: z.string().min(1, "Selecione um local do Medusa"),
    bling_deposit_id: z.string().min(1, "Informe o ID do depósito do Bling"),
    is_default: z.boolean().optional(),
  });

  const syncPreferencesSchema = z.object({
    products: z
      .object({
        enabled: z.boolean().optional(),
        import_images: z.boolean().optional(),
        import_descriptions: z.boolean().optional(),
        import_prices: z.boolean().optional(),
      })
      .optional(),
    inventory: z
      .object({
        enabled: z.boolean().optional(),
        bidirectional: z.boolean().optional(),
        locations: z.array(locationMappingSchema).optional(),
      })
      .optional(),
    orders: z
      .object({
        enabled: z.boolean().optional(),
        send_to_bling: z.boolean().optional(),
        receive_from_bling: z.boolean().optional(),
        generate_nf: z.boolean().optional(),
      })
      .optional(),
  });

  const schema = z
    .object({
      client_id: z.string().max(255).optional(),
      client_secret: z.string().max(255).optional(),
      webhook_secret: z.string().max(255).optional(),
      sync_preferences: syncPreferencesSchema.optional(),
    })
    .strict();

  const validation = schema.safeParse(req.body);
  if (!validation.success) {
    res.status(400).json({
      message: "Invalid input",
      issues: validation.error.issues.map((issue) => ({
        path: issue.path,
        message: issue.message,
      })),
    });
    return;
  }

  const { client_id, client_secret, webhook_secret, sync_preferences } = validation.data;
  const blingService = req.scope.resolve<BlingModuleService>(BLING_MODULE);
  const syncPreferencesInput: BlingSyncPreferencesInput | undefined = sync_preferences
    ? {
        ...(sync_preferences.products
          ? {
              products: {
                ...(sync_preferences.products.enabled !== undefined && {
                  enabled: sync_preferences.products.enabled,
                }),
                ...(sync_preferences.products.import_images !== undefined && {
                  import_images: sync_preferences.products.import_images,
                }),
                ...(sync_preferences.products.import_descriptions !== undefined && {
                  import_descriptions: sync_preferences.products.import_descriptions,
                }),
                ...(sync_preferences.products.import_prices !== undefined && {
                  import_prices: sync_preferences.products.import_prices,
                }),
              },
            }
          : {}),
        ...(sync_preferences.inventory
          ? {
              inventory: {
                ...(sync_preferences.inventory.enabled !== undefined && {
                  enabled: sync_preferences.inventory.enabled,
                }),
                ...(sync_preferences.inventory.bidirectional !== undefined && {
                  bidirectional: sync_preferences.inventory.bidirectional,
                }),
                ...(Array.isArray(sync_preferences.inventory.locations)
                  ? {
                      locations: sync_preferences.inventory.locations.map((location) => ({
                        stock_location_id: location.stock_location_id,
                        bling_deposit_id: location.bling_deposit_id,
                        is_default: location.is_default ?? false,
                      })),
                    }
                  : {}),
              },
            }
          : {}),
        ...(sync_preferences.orders
          ? {
              orders: {
                ...(sync_preferences.orders.enabled !== undefined && {
                  enabled: sync_preferences.orders.enabled,
                }),
                ...(sync_preferences.orders.send_to_bling !== undefined && {
                  send_to_bling: sync_preferences.orders.send_to_bling,
                }),
                ...(sync_preferences.orders.receive_from_bling !== undefined && {
                  receive_from_bling: sync_preferences.orders.receive_from_bling,
                }),
                ...(sync_preferences.orders.generate_nf !== undefined && {
                  generate_nf: sync_preferences.orders.generate_nf,
                }),
              },
            }
          : {}),
      }
    : undefined;

  await blingService.saveBlingConfig({
    clientId: client_id ?? null,
    clientSecret: client_secret ?? null,
    webhookSecret: webhook_secret ?? null,
    ...(syncPreferencesInput ? { syncPreferences: syncPreferencesInput } : {}),
  });

  res.status(200).json({ message: "Bling settings saved successfully." });
}
