import { getRequestConfig } from "next-intl/server";

export default getRequestConfig(async () => {
  return {
    locale: "fr",
    messages: (await import("../messages/fr.json")).default,
  };
});
