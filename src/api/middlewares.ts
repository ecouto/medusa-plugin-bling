import { authenticate, defineMiddlewares } from "@medusajs/framework/http";

export default defineMiddlewares({
  routes: [
    {
      matcher: "/admin/bling*",
      middlewares: [authenticate("user", ["session", "bearer", "api-key"])],
    },
  ],
});
