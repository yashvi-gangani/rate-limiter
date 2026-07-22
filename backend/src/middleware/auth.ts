import { Request, Response, NextFunction } from "express";
import { getApiKey } from "../services/apiKeyService";

export interface AuthedRequest extends Request {
  clientId?: string;
  tier?: string;
}

export async function authMiddleware(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
) {
  const apiKey = (req.header("x-api-key") || "").trim();

  if (!apiKey) {
    // Unauthenticated traffic gets the free tier, keyed by IP.
    req.clientId = `ip:${req.ip}`;
    req.tier = "free";
    return next();
  }

  try {
    const record = await getApiKey(apiKey);
    if (!record) {
      return res.status(401).json({ error: "invalid_api_key" });
    }
    req.clientId = record.clientId;
    req.tier = record.tier;
    next();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[auth] lookup failed:", err);
    res.status(503).json({ error: "auth_service_unavailable" });
  }
}
