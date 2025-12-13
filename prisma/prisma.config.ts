import { defineConfig } from "@prisma/config";

export default defineConfig({
  // Name of the datasource defined in schema.prisma
  datasource: "db",
  datasources: {
    db: {
      url: process.env.DATABASE_URL || "",
    },
  },
});
