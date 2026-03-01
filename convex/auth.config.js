// Our Next.js app issues RS256 JWTs that bridge Neon Auth sessions to Convex.
// JWKS is embedded as a data URI so Convex can validate tokens without reaching our server.
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export default {
  providers: [
    {
      type: "customJwt",
      issuer: APP_URL,
      jwks: "data:text/plain;charset=utf-8;base64,eyJrZXlzIjpbeyJrdHkiOiJSU0EiLCJuIjoic2VSYnRxQVk1cV9qWFU2Um5qaDhGSC1fU19YTFhRRjN1blRSQ0tjWmRMejNFaVJMeklrN0g1X2hCdVRYNEt4LWI1R2I1VldPdXp3eFl0WmEyMktCcTQzcHJfbjE1YVQ4S3FBcGltQmhIaDJwcnBSMkYzYVhzcXg2Nkg2NTY1WktELU00WUowNzloRDBiOEh1X0FNR1J1M2swSHVlVm5fUW9HWUl1X250SnhtX3gxQ3NNM3AtZGtjQU1mTUhXakxIaWpMa2I2RWh1T0FKaFo0WXcxa1hWZmhwdjFKSGZCYUVoNVd6S181a2xPTzBHazhHZ0YxdzI3TGxBTlpEeFhKeUFUYzN3cGV3eWJmaWE0OUJMdGRpQk05a1lBVXpPXy1JLWE2LVlPZF9mdzFwb1BhdGNEYjVPbWxYT0FCR1RpUl9aU0lHYVJuUUJsLUJFMnE5eGdfS3BRIiwiZSI6IkFRQUIiLCJraWQiOiJjb252ZXgtYnJpZGdlLWtleS0xIiwiYWxnIjoiUlMyNTYiLCJ1c2UiOiJzaWcifV19",
      algorithm: "RS256",
    },
  ],
};
