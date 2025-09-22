import { Badge } from "@medusajs/ui"

interface BlingStatusIndicatorProps {
  isConnected: boolean
  className?: string
}

export function BlingStatusIndicator({ isConnected, className }: BlingStatusIndicatorProps) {
  return (
    <Badge
      className={className}
      color={isConnected ? "green" : "red"}
      size="small"
    >
      {isConnected ? "Conectado" : "Desconectado"}
    </Badge>
  )
}