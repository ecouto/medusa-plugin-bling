// Admin utilities for Bling plugin

export function formatBrazilianCurrency(amount: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(amount)
}

export function formatBrazilianDate(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return dateObj.toLocaleDateString('pt-BR')
}

export function formatBrazilianDateTime(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return dateObj.toLocaleString('pt-BR')
}

export function validateCNPJ(cnpj: string): boolean {
  // Basic CNPJ validation
  const cleaned = cnpj.replace(/\D/g, '')
  return cleaned.length === 14
}

export function validateCPF(cpf: string): boolean {
  // Basic CPF validation
  const cleaned = cpf.replace(/\D/g, '')
  return cleaned.length === 11
}

export function formatCEP(cep: string): string {
  const cleaned = cep.replace(/\D/g, '')
  return cleaned.replace(/(\d{5})(\d{3})/, '$1-$2')
}