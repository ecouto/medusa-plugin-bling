import { defineConfig } from "@medusajs/admin-sdk"

// Export admin customizations
export default defineConfig({
  // Routes will be automatically discovered from src/admin/routes/
  // Widgets will be automatically discovered from src/admin/widgets/
})

// Export any custom hooks or utilities for admin
export * from "./hooks"
export * from "./components"
export * from "./utils"