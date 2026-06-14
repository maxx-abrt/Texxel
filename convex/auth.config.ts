// WorkOS AuthKit OIDC provider.
// WORKOS_CLIENT_ID is set in both Convex deployments (dev + prod) via `convex env set`.
export default {
  providers: [
    {
      domain: "https://api.workos.com",
      applicationID: process.env.WORKOS_CLIENT_ID!,
    },
  ],
};
