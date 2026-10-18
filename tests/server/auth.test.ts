import { afterEach, expect, test, vi } from "vitest";
import { verifyDiscordUserId } from "../../server/auth";

afterEach(() => {
  vi.unstubAllGlobals();
});

test("returns the Discord user id for a valid token", async () => {
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => Response.json({ id: "123" }));
  vi.stubGlobal("fetch", fetchMock);
  await expect(verifyDiscordUserId("tok")).resolves.toBe("123");
  expect(fetchMock.mock.calls[0][1]).toEqual({ headers: { Authorization: "Bearer tok" } });
});

test("rejects a token Discord does not accept", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 401 })));
  await expect(verifyDiscordUserId("bad")).rejects.toThrow("INVALID_TOKEN");
});
