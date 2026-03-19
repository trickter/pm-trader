import { vi } from "vitest";

// Mock environment variables for tests
vi.stubEnv("DATABASE_URL", "postgresql://test:test@localhost:5432/test");
vi.stubEnv("POLYMARKET_CLOB_HOST", "https://clob.polymarket.com");
vi.stubEnv("POLYMARKET_API_HOST", "https://gamma.polymarket.com");
vi.stubEnv("POLYMARKET_CHAIN_ID", "137");
vi.stubEnv("ADMIN_TOKEN", "test-admin-token");
vi.stubEnv("BEARER_TOKEN", "test-bearer-token");
vi.stubEnv("POLY_MARKETS_API_KEY", "test-api-key");

// Mock console.error to reduce noise in tests unless explicitly needed
vi.spyOn(console, "error").mockImplementation((...args) => {
  if (process.env.DEBUG_TEST_ERRORS) {
    console.log("[TEST ERROR]", ...args);
  }
});
