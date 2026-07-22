import { Request, Response, NextFunction } from "express";
import { httpRequestDuration } from "../routes/metrics";

export function latencyMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = process.hrtime.bigint();

  res.on("finish", () => {
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1_000_000;
    httpRequestDuration
      .labels(req.method, req.route?.path || req.path, res.statusCode.toString())
      .observe(durationMs);
  });

  next();
}
