export interface BlingPluginOptions {
  client_id: string
  client_secret: string
  access_token?: string
  refresh_token?: string
  environment?: "sandbox" | "production"
  webhook_secret?: string
  auto_sync_orders?: boolean
  auto_sync_inventory?: boolean
  auto_generate_labels?: boolean
}

export interface BlingAuthResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
}

export interface BlingProduct {
  id: number
  codigo?: string
  descricao: string
  tipo: string
  situacao: string
  unidade: string
  preco: number
  precoCusto?: number
  pesoLiq?: number
  pesoBruto?: number
  volumes?: number
  itensPorCaixa?: number
  gtin?: string
  gtinEmbalagem?: string
  tipoProducao?: string
  condicao?: number
  freteGratis?: boolean
  marca?: string
  descricaoCurta?: string
  descricaoComplementar?: string
  linkExterno?: string
  observacoes?: string
  descricaoFornecedor?: string
  garantia?: number
  cest?: string
  ncm?: string
  origem?: number
  grupoProduto?: {
    id: number
  }
  estoque?: {
    minimo?: number
    maximo?: number
    crossdocking?: number
    localizacao?: string
  }
  actionEstoque?: string
  tipoEstoque?: string
}

export interface BlingOrder {
  id?: number
  numero?: number
  numeroLoja?: string
  data: string
  dataSaida?: string
  dataPrevista?: string
  totalProdutos: number
  totalVenda: number
  situacao?: {
    id: number
    valor: number
  }
  loja?: {
    id: number
  }
  numeroPedidoLoja?: string
  contato: {
    id?: number
    nome: string
    tipoPessoa?: string
    contribuinte?: number
    ie?: string
    rg?: string
    orgaoEmissor?: string
    email?: string
    celular?: string
    fone?: string
    endereco?: {
      endereco: string
      numero?: string
      complemento?: string
      bairro?: string
      cep: string
      municipio?: string
      uf?: string
    }
  }
  itens: Array<{
    codigo?: string
    descricao: string
    unidade?: string
    quantidade: number
    valor: number
    produto?: {
      id: number
    }
  }>
  parcelas?: Array<{
    numeroDias: number
    valor: number
    observacoes?: string
    formaPagamento?: {
      id: number
    }
  }>
  transporte?: {
    transportadora?: {
      id: number
    }
    tipoFrete?: number
    valorFrete?: number
    prazoEntrega?: number
    contato?: {
      tipoPessoa?: string
      nome?: string
      ie?: string
      contribuinte?: number
      endereco?: {
        endereco: string
        numero?: string
        complemento?: string
        bairro?: string
        cep: string
        municipio?: string
        uf?: string
      }
    }
    volumes?: Array<{
      servico?: string
      codigoRastreamento?: string
    }>
  }
  observacoes?: string
  observacoesInternas?: string
  vendedor?: {
    id: number
  }
}

export interface BlingWebhookEvent {
  topic: string
  event: string
  data: {
    id: number
    type: string
  }
  timestamp: string
}

export interface BlingApiResponse<T> {
  data: T[]
}

export interface BlingApiError {
  error: {
    type: string
    message: string
    description?: string
  }
}