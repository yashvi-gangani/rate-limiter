import { Request, Response, NextFunction } from "express";
import { config } from "../config";

/**
 * Simple shared-secret admin auth. Good enough for a demo/resume project;
 * in a real system this would be a proper authenticated admin user with
 * role-based access control, not a single static key.
 */
export function adminAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  const key = req.header("x-admin-key");
  if (!key || key !== config.adminKey) {
    return res.status(401).json({ error: "unauthorized_admin_request" });
  }
  next();
}
