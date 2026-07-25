import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { protectedProcedure, publicProcedure, router } from "../trpc";
import { resolveMobileSession } from "../workos";

const sealedInput = z.object({
  sealed: z.string().min(1),
  force: z.boolean().optional(),
});

/**
 * Session bridge used by the Expo app.
 *
 * `exchange` is called once right after the WorkOS hand-off deep link, then
 * `exchange({ force: true })` is used as the refresh path when Convex asks for
 * a fresh token.
 */
export const sessionRouter = router({
  exchange: publicProcedure.input(sealedInput).mutation(async ({ input }) => {
    try {
      return await resolveMobileSession(input.sealed, { force: input.force });
    } catch {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "invalid_session" });
    }
  }),

  me: protectedProcedure.query(({ ctx }) => ctx.user),
});
