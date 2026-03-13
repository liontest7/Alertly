import { describe, it, expect } from "vitest";

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:5000";

async function get(path: string) {
  const res = await fetch(`${BASE_URL}${path}`);
  return { status: res.status, ok: res.ok, body: await res.json().catch(() => null) };
}

describe("API Health Checks", () => {
  it("GET /api/health returns 200", async () => {
    const { status } = await get("/api/health");
    expect(status).toBe(200);
  });

  it("GET /api/alerts returns array", async () => {
    const { ok, body } = await get("/api/alerts");
    expect(ok).toBe(true);
    expect(Array.isArray(body)).toBe(true);
  });

  it("GET /api/auth/session returns valid shape", async () => {
    const { ok, body } = await get("/api/auth/session");
    expect(ok).toBe(true);
    expect(body).toHaveProperty("authenticated");
  });

  it("GET /api/extension/sync returns valid shape", async () => {
    const { ok, body } = await get("/api/extension/sync");
    expect(ok).toBe(true);
    expect(body).toHaveProperty("authenticated");
  });

  it("GET /api/admin/overview returns 403 without auth", async () => {
    const { status } = await get("/api/admin/overview");
    expect(status).toBe(403);
  });
});
