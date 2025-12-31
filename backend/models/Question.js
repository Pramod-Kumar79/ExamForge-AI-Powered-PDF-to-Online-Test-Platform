const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema({
  pdfUploadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "PDFUpload",
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  questionNumber: {
    type: Number,
    required: true,
  },
  originalQuestionText: {
    type: String,
    required: true,
  },
  questionText: {
    type: String,
    required: true,
  },
  options: [
    {
      optionId: {
        type: String,
        required: true,
      },
      originalText: String,
      text: {
        type: String,
        required: true,
      },
      isCorrect: {
        type: Boolean,
        default: false,
      },
    },
  ],
  correctAnswer: {
    type: String,
    required: true,
  },
  questionType: {
    type: String,
    enum: ["mcq", "true-false", "numerical", "match"],
    default: "mcq",
  },
  difficulty: {
    type: String,
    enum: ["easy", "medium", "hard"],
    default: "medium",
  },
  topic: {
    type: String,
  },
  subtopic: {
    type: String,
  },
  explanation: {
    type: String,
  },
  marks: {
    type: Number,
    default: 1,
  },
  negativeMarks: {
    type: Number,
    default: 0,
  },
  pageNumber: {
    type: Number,
  },
  aiConfidence: {
    type: Number,
    min: 0,
    max: 1,
  },
  status: {
    type: String,
    enum: ["extracted", "verified", "edited", "needs_review"],
    default: "extracted",
  },
  tags: [
    {
      type: String,
    },
  ],
  metadata: {
    type: mongoose.Schema.Types.Mixed,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Update timestamp
questionSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

// Indexes
questionSchema.index({ pdfUploadId: 1, questionNumber: 1 });
questionSchema.index({ userId: 1, topic: 1 });
questionSchema.index({ tags: 1 });
questionSchema.index({ status: 1 });
// Add to existing indexes
questionSchema.index({ accuracy: -1 });
questionSchema.index({ status: 1, aiConfidence: -1 });
questionSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Question", questionSchema);
