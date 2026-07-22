import mongoose, { Schema, Document } from "mongoose";

export interface TierDoc extends Document {
  name: string;
  capacity: number;
  refillRatePerSec: number;
  windowSizeMs: number;
  maxRequestsPerWindow: number;
  updatedAt: Date;
}

const TierSchema = new Schema<TierDoc>({
  name: { type: String, required: true, unique: true, index: true },
  capacity: { type: Number, required: true },
  refillRatePerSec: { type: Number, required: true },
  windowSizeMs: { type: Number, required: true },
  maxRequestsPerWindow: { type: Number, required: true },
  updatedAt: { type: Date, default: () => new Date() },
});

export const TierModel = mongoose.model<TierDoc>("Tier", TierSchema);
