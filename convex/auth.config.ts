// Convex auth providers.
// During the WorkOS migration we trust BOTH the current convex-auth tokens AND
// WorkOS AuthKit JWTs so nothing breaks while cutting over. Once WorkOS is fully
// wired and verified, the convex-auth provider line can be removed.
const clientId = "client_01KV3J2M42HT3P59CBKMQMZ998"; // public WorkOS client id (no env dependency so deploy never fails)

const authConfig = {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL,
      applicationID: "convex",
    },
  ],
};

export default authConfig;
