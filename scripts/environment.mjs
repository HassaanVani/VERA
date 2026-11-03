import nextEnv from "@next/env";

// Match Next.js precedence for CLI tools and workers, including .env and .env.local.
nextEnv.loadEnvConfig(process.cwd(), process.env.NODE_ENV === "development");
