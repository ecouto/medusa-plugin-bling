import { BlingOrder, BlingProduct } from "../types"

class BlingMapper {
  static medusaOrderToBling(medusaOrder: any): Partial<BlingOrder> {
    const blingOrder: Partial<BlingOrder> = {
      data: new Date(medusaOrder.created_at).toISOString().split('T')[0],
      totalProdutos: medusaOrder.subtotal / 100, // Convert from cents
      totalVenda: medusaOrder.total / 100, // Convert from cents
      numeroPedidoLoja: medusaOrder.display_id?.toString(),
      
      contato: {
        nome: `${medusaOrder.billing_address?.first_name || ''} ${medusaOrder.billing_address?.last_name || ''}`.trim(),
        email: medusaOrder.email,
        fone: medusaOrder.billing_address?.phone,
        endereco: medusaOrder.shipping_address ? {
          endereco: medusaOrder.shipping_address.address_1,
          numero: medusaOrder.shipping_address.address_2 || "S/N",
          bairro: medusaOrder.shipping_address.city,
          cep: medusaOrder.shipping_address.postal_code?.replace(/\D/g, ''),
          municipio: medusaOrder.shipping_address.city,
          uf: medusaOrder.shipping_address.province
        } : undefined
      },

      itens: medusaOrder.items?.map((item: any) => ({
        descricao: item.title,
        quantidade: item.quantity,
        valor: item.unit_price / 100, // Convert from cents
        produto: item.variant?.product?.metadata?.bling_id ? {
          id: parseInt(item.variant.product.metadata.bling_id)
        } : undefined
      })) || [],

      observacoes: medusaOrder.metadata?.notes || `Pedido criado via Medusa - ID: ${medusaOrder.id}`,
      
      transporte: medusaOrder.shipping_methods?.[0] ? {
        valorFrete: medusaOrder.shipping_total / 100, // Convert from cents
        contato: medusaOrder.shipping_address ? {
          nome: `${medusaOrder.shipping_address.first_name || ''} ${medusaOrder.shipping_address.last_name || ''}`.trim(),
          endereco: {
            endereco: medusaOrder.shipping_address.address_1,
            numero: medusaOrder.shipping_address.address_2 || "S/N",
            bairro: medusaOrder.shipping_address.city,
            cep: medusaOrder.shipping_address.postal_code?.replace(/\D/g, ''),
            municipio: medusaOrder.shipping_address.city,
            uf: medusaOrder.shipping_address.province
          }
        } : undefined
      } : undefined
    }

    return blingOrder
  }

  static medusaProductToBling(medusaProduct: any): Partial<BlingProduct> {
    const variant = medusaProduct.variants?.[0] // Use first variant as default
    
    const blingProduct: Partial<BlingProduct> = {
      descricao: medusaProduct.title,
      tipo: "P", // P = Produto
      situacao: "A", // A = Ativo
      unidade: "UN", // Unidade
      preco: variant?.prices?.find((p: any) => p.currency_code === 'brl')?.amount / 100 || 0,
      pesoLiq: medusaProduct.weight || 0,
      pesoBruto: medusaProduct.weight || 0,
      gtin: variant?.ean || medusaProduct.metadata?.gtin,
      marca: medusaProduct.collection?.title,
      descricaoCurta: medusaProduct.subtitle,
      descricaoComplementar: medusaProduct.description,
      observacoes: `Produto sincronizado via Medusa - ID: ${medusaProduct.id}`,
      
      estoque: {
        minimo: medusaProduct.metadata?.stock_min || 0,
        maximo: medusaProduct.metadata?.stock_max || 1000,
        localizacao: medusaProduct.metadata?.location || "LOJA"
      }
    }

    // Add SKU if available
    if (variant?.sku) {
      blingProduct.codigo = variant.sku
    }

    return blingProduct
  }

  static blingProductToMedusa(blingProduct: BlingProduct): any {
    return {
      title: blingProduct.descricao,
      subtitle: blingProduct.descricaoCurta,
      description: blingProduct.descricaoComplementar,
      weight: blingProduct.pesoLiq,
      metadata: {
        bling_id: blingProduct.id,
        bling_codigo: blingProduct.codigo,
        gtin: blingProduct.gtin,
        stock_min: blingProduct.estoque?.minimo,
        stock_max: blingProduct.estoque?.maximo,
        location: blingProduct.estoque?.localizacao
      },
      variants: [
        {
          title: blingProduct.descricao,
          sku: blingProduct.codigo,
          ean: blingProduct.gtin,
          weight: blingProduct.pesoLiq,
          prices: [
            {
              currency_code: "brl",
              amount: Math.round(blingProduct.preco * 100) // Convert to cents
            }
          ],
          inventory_quantity: blingProduct.estoque?.minimo || 0,
          metadata: {
            bling_id: blingProduct.id
          }
        }
      ]
    }
  }

  static blingOrderToMedusa(blingOrder: BlingOrder): any {
    return {
      display_id: blingOrder.numeroLoja || blingOrder.numero?.toString(),
      email: blingOrder.contato.email,
      status: this.mapBlingOrderStatus(blingOrder.situacao?.valor),
      
      billing_address: {
        first_name: blingOrder.contato.nome?.split(' ')[0] || '',
        last_name: blingOrder.contato.nome?.split(' ').slice(1).join(' ') || '',
        phone: blingOrder.contato.fone || blingOrder.contato.celular,
        address_1: blingOrder.contato.endereco?.endereco,
        address_2: blingOrder.contato.endereco?.numero,
        city: blingOrder.contato.endereco?.municipio,
        postal_code: blingOrder.contato.endereco?.cep,
        province: blingOrder.contato.endereco?.uf
      },

      shipping_address: blingOrder.transporte?.contato ? {
        first_name: blingOrder.transporte.contato.nome?.split(' ')[0] || '',
        last_name: blingOrder.transporte.contato.nome?.split(' ').slice(1).join(' ') || '',
        address_1: blingOrder.transporte.contato.endereco?.endereco,
        address_2: blingOrder.transporte.contato.endereco?.numero,
        city: blingOrder.transporte.contato.endereco?.municipio,
        postal_code: blingOrder.transporte.contato.endereco?.cep,
        province: blingOrder.transporte.contato.endereco?.uf
      } : undefined,

      items: blingOrder.itens?.map(item => ({
        title: item.descricao,
        quantity: item.quantidade,
        unit_price: Math.round(item.valor * 100), // Convert to cents
        metadata: {
          bling_product_id: item.produto?.id
        }
      })) || [],

      subtotal: Math.round(blingOrder.totalProdutos * 100), // Convert to cents
      total: Math.round(blingOrder.totalVenda * 100), // Convert to cents
      shipping_total: blingOrder.transporte?.valorFrete ? Math.round(blingOrder.transporte.valorFrete * 100) : 0,

      metadata: {
        bling_id: blingOrder.id,
        bling_numero: blingOrder.numero,
        bling_observacoes: blingOrder.observacoes,
        bling_observacoes_internas: blingOrder.observacoesInternas
      }
    }
  }

  private static mapBlingOrderStatus(blingStatus?: number): string {
    const statusMap: { [key: number]: string } = {
      0: "pending", // Em aberto
      1: "pending", // Em andamento
      2: "completed", // Venda agendada
      3: "completed", // Faturado
      4: "completed", // Pronto para envio
      5: "completed", // Enviado
      6: "completed", // Entregue
      9: "canceled", // Cancelado
      12: "canceled", // Devolvido
      15: "canceled" // Cancelado pelo cliente
    }

    return blingStatus !== undefined ? statusMap[blingStatus] || "pending" : "pending"
  }

  static formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  static formatDate(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date
    return d.toISOString().split('T')[0]
  }

  static sanitizeCEP(cep: string): string {
    return cep?.replace(/\D/g, '') || ''
  }

  static validateCPF(cpf: string): boolean {
    cpf = cpf.replace(/\D/g, '')
    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false
    
    let sum = 0
    for (let i = 0; i < 9; i++) {
      sum += parseInt(cpf.charAt(i)) * (10 - i)
    }
    let remainder = (sum * 10) % 11
    if (remainder === 10 || remainder === 11) remainder = 0
    if (remainder !== parseInt(cpf.charAt(9))) return false
    
    sum = 0
    for (let i = 0; i < 10; i++) {
      sum += parseInt(cpf.charAt(i)) * (11 - i)
    }
    remainder = (sum * 10) % 11
    if (remainder === 10 || remainder === 11) remainder = 0
    return remainder === parseInt(cpf.charAt(10))
  }

  static validateCNPJ(cnpj: string): boolean {
    cnpj = cnpj.replace(/\D/g, '')
    if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false
    
    let length = cnpj.length - 2
    let numbers = cnpj.substring(0, length)
    let digits = cnpj.substring(length)
    let sum = 0
    let pos = length - 7
    
    for (let i = length; i >= 1; i--) {
      sum += parseInt(numbers.charAt(length - i)) * pos--
      if (pos < 2) pos = 9
    }
    
    let result = sum % 11 < 2 ? 0 : 11 - sum % 11
    if (result !== parseInt(digits.charAt(0))) return false
    
    length = length + 1
    numbers = cnpj.substring(0, length)
    sum = 0
    pos = length - 7
    
    for (let i = length; i >= 1; i--) {
      sum += parseInt(numbers.charAt(length - i)) * pos--
      if (pos < 2) pos = 9
    }
    
    result = sum % 11 < 2 ? 0 : 11 - sum % 11
    return result === parseInt(digits.charAt(1))
  }
}

export default BlingMapper