import mongoose from "mongoose";

const practiceSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    kitId: { type: mongoose.Schema.Types.ObjectId, ref: "Kit", required: true, index: true },
    flashcardId: { type: String, required: true },
    confidence: { type: Number, required: true, min: 1, max: 5 },
    covered: { type: Boolean, default: true },
  },
  { timestamps: true },
);

practiceSchema.index({ kitId: 1, flashcardId: 1, userId: 1 }, { unique: true });

export const PracticeRecord =
  mongoose.models.PracticeRecord ?? mongoose.model("PracticeRecord", practiceSchema);
