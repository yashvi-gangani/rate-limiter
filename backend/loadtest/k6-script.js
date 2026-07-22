import http from "k6/http";
import { check, sleep } from "k6";
import { Rate } from "k6/metrics";

export const blockedRate = new Rate("rate_limited_requests");

// Simulates 3 client tiers hitting the gateway concurrently.
// Run with:  k6 run loadtest/k6-script.js
// Or override target: k6 run -e BASE_URL=https://your-deployed-url loadtest/k6-script.js

const BASE_URL = __ENV.BASE_URL || "http://localhost:8080";

export const options = {
  scenarios: {
    free_tier: {
      executor: "constant-arrival-rate",
      rate: 5,
      timeUnit: "1s",
      duration: "30s",
      preAllocatedVUs: 10,
      exec: "hitFreeTier",
    },
    pro_tier: {
      executor: "constant-arrival-rate",
      rate: 20,
      timeUnit: "1s",
      duration: "30s",
      preAllocatedVUs: 30,
      exec: "hitProTier",
    },
    burst_test: {
      executor: "ramping-arrival-rate",
      startRate: 0,
      timeUnit: "1s",
      preAllocatedVUs: 200,
      stages: [
        { target: 300, duration: "10s" }, // sudden burst
        { target: 300, duration: "10s" },
        { target: 0, duration: "5s" },
      ],
      exec: "hitEnterpriseTier",
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<200", "p(99)<500"],
  },
};

export function hitFreeTier() {
  const res = http.get(`${BASE_URL}/api/demo/ping`, {
    headers: { "x-api-key": "demo-free-key" },
  });
  check(res, { "status is 200 or 429": (r) => r.status === 200 || r.status === 429 });
  blockedRate.add(res.status === 429);
  sleep(0.1);
}

export function hitProTier() {
  const res = http.get(`${BASE_URL}/api/demo/ping`, {
    headers: { "x-api-key": "demo-pro-key" },
  });
  check(res, { "status is 200 or 429": (r) => r.status === 200 || r.status === 429 });
  blockedRate.add(res.status === 429);
}

export function hitEnterpriseTier() {
  const res = http.get(`${BASE_URL}/api/demo/heavy`, {
    headers: { "x-api-key": "demo-enterprise-key" },
  });
  check(res, { "status is 200 or 429": (r) => r.status === 200 || r.status === 429 });
  blockedRate.add(res.status === 429);
}
