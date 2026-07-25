import { configRouter } from "./routers/config";
import { sessionRouter } from "./routers/session";
import { router } from "./trpc";

export const appRouter = router({
  config: configRouter,
  session: sessionRouter,
});

export type AppRouter = typeof appRouter;
