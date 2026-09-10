import mongoose, { Document, Schema } from "mongoose";

export interface IWelcomeTemplate {
  name: string;
  title: string;
  description: string;
  imageUrl?: string;
  thumbnailType: "user_avatar" | "custom" | "none";
  customThumbnailUrl?: string;
  color?: string;
}

export interface IWelcomeConfig extends Document {
  guildId: string;
  channelId: string;
  isEnabled: boolean;
  activeTemplateName: string;
  templates: IWelcomeTemplate[];
  createdAt: Date;
  updatedAt: Date;
}

const WelcomeTemplateSchema = new Schema<IWelcomeTemplate>(
  {
    name: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    imageUrl: { type: String, default: "" },
    thumbnailType: {
      type: String,
      enum: ["user_avatar", "custom", "none"],
      default: "user_avatar",
    },
    customThumbnailUrl: { type: String, default: "" },
    color: { type: String, default: "#5865F2" },
  },
  { _id: false }
);

const WelcomeConfigSchema = new Schema<IWelcomeConfig>(
  {
    guildId: { type: String, required: true, unique: true, index: true },
    channelId: { type: String, default: "1546765150676324432" },
    isEnabled: { type: Boolean, default: true },
    activeTemplateName: { type: String, default: "default" },
    templates: { type: [WelcomeTemplateSchema], default: [] },
  },
  { timestamps: true }
);

export const WelcomeConfig = mongoose.model<IWelcomeConfig>(
  "WelcomeConfig",
  WelcomeConfigSchema
);
