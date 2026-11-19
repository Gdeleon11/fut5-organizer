import { test as base, expect } from "@playwright/test";

// Keep browser traffic local even on a Mac with internet access.
export const test = base.extend({
  context: async ({ context, baseURL }, use) => {
    const local = new URL(baseURL).origin;
    await context.route("**/*", route => {
      const url = new URL(route.request().url());
      if (url.origin === local) return route.continue();
      if (["api.open-meteo.com", "archive-api.open-meteo.com"].includes(url.hostname)) {
        return route.fulfill({ json: { daily: {
          time: [url.searchParams.get("start_date")], weathercode: [2],
          temperature_2m_max: [22], temperature_2m_min: [16],
          precipitation_probability_max: [30], windspeed_10m_max: [8],
        } } });
      }
      return route.abort();
    });
    await use(context);
  },
});
export { expect };
