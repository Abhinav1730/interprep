import mongoose from "mongoose";

const kitSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    status: {
      type: String,
      enum: ["queued", "generating", "completed", "failed"],
      default: "queued",
    },
    input: {
      jd: { type: String, required: true },
      companyUrl: { type: String, required: true },
      days: { type: Number, required: true },
    },
    inputHash: { type: String, required: true, index: true },
    kit: { type: mongoose.Schema.Types.Mixed, default: null },
    generation: { type: mongoose.Schema.Types.Mixed, default: {} },
    error: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true },
);

kitSchema.index({ userId: 1, inputHash: 1 });

export const KitModel = mongoose.models.Kit ?? mongoose.model("Kit", kitSchema);
