import mongoose, { Schema, Document } from "mongoose";

export interface ApiKeyDoc extends Document {
  key: string;
  clientId: string;
  tier: string;
  createdAt: Date;
}

const ApiKeySchema = new Schema<ApiKeyDoc>({
  key: { type: String, required: true, unique: true, index: true },
  clientId: { type: String, required: true },
  tier: { type: String, required: true },
  createdAt: { type: Date, default: () => new Date() },
});

export const ApiKeyModel = mongoose.model<ApiKeyDoc>("ApiKey", ApiKeySchema);
