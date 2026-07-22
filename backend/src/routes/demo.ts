import { Router } from "express";
import { AuthedRequest } from "../middleware/auth";

export const demoRouter = Router();

// A cheap endpoint — good for testing sustained throughput
demoRouter.get("/ping", (req: AuthedRequest, res) => {
  res.json({ message: "pong", clientId: req.clientId, tier: req.tier, ts: Date.now() });
});

// An artificially slower endpoint — good for testing burst behavior
demoRouter.get("/heavy", async (req: AuthedRequest, res) => {
  await new Promise((r) => setTimeout(r, 50));
  res.json({ message: "heavy work done", clientId: req.clientId, tier: req.tier });
});

demoRouter.get("/whoami", (req: AuthedRequest, res) => {
  res.json({ clientId: req.clientId, tier: req.tier });
});
