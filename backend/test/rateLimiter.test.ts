import { MemoryStore } from "../src/store/memoryStore";

describe("Token Bucket", () => {
  it("allows requests up to capacity, then blocks", async () => {
    const store = new MemoryStore();
    const now = Date.now();
    const capacity = 5;
    const refillRate = 1; // 1 token/sec

    for (let i = 0; i < capacity; i++) {
      const result = await store.consumeTokenBucket("client-a", capacity, refillRate, now);
      expect(result.allowed).toBe(true);
    }

    // bucket should now be empty
    const blocked = await store.consumeTokenBucket("client-a", capacity, refillRate, now);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it("refills tokens over time", async () => {
    const store = new MemoryStore();
    const capacity = 2;
    const refillRate = 1; // 1 token/sec
    let now = Date.now();

    await store.consumeTokenBucket("client-b", capacity, refillRate, now);
    await store.consumeTokenBucket("client-b", capacity, refillRate, now);
    const blocked = await store.consumeTokenBucket("client-b", capacity, refillRate, now);
    expect(blocked.allowed).toBe(false);

    // advance 1.5 seconds -> should have ~1.5 tokens available
    now += 1500;
    const allowed = await store.consumeTokenBucket("client-b", capacity, refillRate, now);
    expect(allowed.allowed).toBe(true);
  });

  it("tracks separate buckets per client key", async () => {
    const store = new MemoryStore();
    const now = Date.now();
    await store.consumeTokenBucket("client-c", 1, 1, now);
    const other = await store.consumeTokenBucket("client-d", 1, 1, now);
    expect(other.allowed).toBe(true); // different key, unaffected
  });
});

describe("Sliding Window Counter", () => {
  it("allows requests up to the max within a window", async () => {
    const store = new MemoryStore();
    const now = Date.now();
    const windowMs = 1000;
    const maxRequests = 3;

    for (let i = 0; i < maxRequests; i++) {
      const result = await store.consumeSlidingWindow("client-e", windowMs, maxRequests, now);
      expect(result.allowed).toBe(true);
    }

    const blocked = await store.consumeSlidingWindow("client-e", windowMs, maxRequests, now);
    expect(blocked.allowed).toBe(false);
  });

  it("smooths bursts across window boundaries (weighted average)", async () => {
    const store = new MemoryStore();
    const windowMs = 1000;
    const maxRequests = 10;

    // fill the first window near the boundary
    let now = Math.floor(Date.now() / windowMs) * windowMs + 900; // 90% through window
    for (let i = 0; i < 10; i++) {
      await store.consumeSlidingWindow("client-f", windowMs, maxRequests, now);
    }

    // move 200ms into the NEXT window — weighted estimate should still
    // partially count the previous burst, preventing a full new burst of 10
    now += 200;
    let allowedCount = 0;
    for (let i = 0; i < 10; i++) {
      const r = await store.consumeSlidingWindow("client-f", windowMs, maxRequests, now);
      if (r.allowed) allowedCount++;
    }
    expect(allowedCount).toBeLessThan(10);
  });
});
