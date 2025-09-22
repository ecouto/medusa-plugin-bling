import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const blingService = req.scope.resolve("blingService")
    const manager = req.scope.resolve("manager")

    // Get sync configuration
    const configResult = await manager.query(`
      SELECT * FROM bling_configuration
      ORDER BY updated_at DESC
      LIMIT 1
    `)

    if (configResult.length === 0 || !configResult[0].sync_products_enabled) {
      return res.status(400).json({
        error: "Sincronização de produtos não configurada ou desabilitada"
      })
    }

    const config = configResult[0]

    // Start background sync (this should ideally be a workflow or job)
    res.json({
      success: true,
      message: "Sincronização de produtos iniciada",
      job_id: "sync-products-" + Date.now()
    })

    // Run sync in background
    setImmediate(async () => {
      try {
        await syncProductsFromBling(blingService, manager, config)
      } catch (error) {
        console.error("Background product sync failed:", error)
      }
    })

  } catch (error: any) {
    console.error("Product sync initiation failed:", error)
    return res.status(500).json({
      error: "Erro ao iniciar sincronização de produtos",
      details: process.env.NODE_ENV === "development" ? error.message : undefined
    })
  }
}

async function syncProductsFromBling(blingService: any, manager: any, config: any) {
  console.log("Starting product sync from Bling...")

  try {
    let page = 1
    let totalSynced = 0
    const pageSize = 50

    while (true) {
      // Get products from Bling
      const blingProducts = await blingService.listProducts({
        limite: pageSize,
        pagina: page
      })

      if (!blingProducts || blingProducts.length === 0) {
        break
      }

      for (const blingProduct of blingProducts) {
        try {
          await syncSingleProduct(blingProduct, manager, config)
          totalSynced++
        } catch (error) {
          console.error(`Error syncing product ${blingProduct.id}:`, error)
        }
      }

      page++

      // Safety break after 1000 products
      if (totalSynced >= 1000) {
        console.log("Reached 1000 products limit, stopping sync")
        break
      }
    }

    // Update last sync timestamp
    await manager.query(`
      UPDATE bling_configuration SET
        last_sync = NOW(),
        updated_at = NOW()
      WHERE id = (
        SELECT id FROM bling_configuration
        ORDER BY updated_at DESC
        LIMIT 1
      )
    `)

    console.log(`Product sync completed. Synced ${totalSynced} products.`)

  } catch (error) {
    console.error("Product sync failed:", error)
    throw error
  }
}

async function syncSingleProduct(blingProduct: any, manager: any, config: any) {
  // Check if product already exists
  const existingResult = await manager.query(`
    SELECT id FROM product
    WHERE metadata->>'bling_id' = $1
  `, [blingProduct.id.toString()])

  const productData = {
    title: blingProduct.descricao,
    handle: generateHandle(blingProduct.descricao),
    description: config.sync_products_import_descriptions ?
      (blingProduct.descricaoComplementar || blingProduct.descricao) : null,
    status: blingProduct.situacao === 'A' ? 'published' : 'draft',
    metadata: {
      bling_id: blingProduct.id.toString(),
      bling_codigo: blingProduct.codigo,
      bling_synced_at: new Date().toISOString()
    }
  }

  if (existingResult.length > 0) {
    // Update existing product
    const productId = existingResult[0].id

    await manager.query(`
      UPDATE product SET
        title = $1,
        description = $2,
        status = $3,
        metadata = metadata || $4,
        updated_at = NOW()
      WHERE id = $5
    `, [
      productData.title,
      productData.description,
      productData.status,
      JSON.stringify(productData.metadata),
      productId
    ])

    // Update variant if price sync is enabled
    if (config.sync_products_import_prices && blingProduct.preco) {
      await updateProductVariantPrice(manager, productId, blingProduct.preco)
    }

  } else {
    // Create new product
    const productId = await createNewProduct(manager, productData, blingProduct, config)

    // Create variant with price
    if (blingProduct.preco) {
      await createProductVariant(manager, productId, blingProduct, config)
    }
  }
}

function generateHandle(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .trim()
}

async function createNewProduct(manager: any, productData: any, blingProduct: any, config: any): Promise<string> {
  const result = await manager.query(`
    INSERT INTO product (
      title, handle, description, status, metadata, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
    RETURNING id
  `, [
    productData.title,
    productData.handle,
    productData.description,
    productData.status,
    JSON.stringify(productData.metadata)
  ])

  return result[0].id
}

async function createProductVariant(manager: any, productId: string, blingProduct: any, config: any) {
  const variantData = {
    title: "Default",
    sku: blingProduct.codigo || null,
    product_id: productId,
    metadata: {
      bling_id: blingProduct.id.toString()
    }
  }

  const result = await manager.query(`
    INSERT INTO product_variant (
      title, sku, product_id, metadata, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, NOW(), NOW())
    RETURNING id
  `, [
    variantData.title,
    variantData.sku,
    variantData.product_id,
    JSON.stringify(variantData.metadata)
  ])

  const variantId = result[0].id

  // Add price if enabled
  if (config.sync_products_import_prices && blingProduct.preco) {
    await manager.query(`
      INSERT INTO money_amount (
        currency_code, amount, variant_id, created_at, updated_at
      ) VALUES ('BRL', $1, $2, NOW(), NOW())
    `, [
      Math.round(blingProduct.preco * 100), // Convert to cents
      variantId
    ])
  }
}

async function updateProductVariantPrice(manager: any, productId: string, price: number) {
  await manager.query(`
    UPDATE money_amount SET
      amount = $1,
      updated_at = NOW()
    WHERE variant_id IN (
      SELECT id FROM product_variant WHERE product_id = $2
    ) AND currency_code = 'BRL'
  `, [
    Math.round(price * 100), // Convert to cents
    productId
  ])
}