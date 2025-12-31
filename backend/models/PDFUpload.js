const mongoose = require("mongoose");

const pdfUploadSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  originalName: {
    type: String,
    required: true,
  },
  fileName: {
    type: String,
    required: true,
  },
  fileSize: {
    type: Number,
    required: true,
  },
  fileUrl: {
    type: String,
    required: true,
  },
  thumbnailUrl: {
    type: String,
  },
  examType: {
    type: String,
    enum: [
      "upsc",
      "ssc",
      "jee",
      "neet",
      "banking",
      "cat",
      "gate",
      "state-psc",
      "other",
    ],
    required: true,
  },
  examYear: {
    type: Number,
    required: true,
  },
  paperType: {
    type: String,
    enum: [
      "prelims",
      "mains",
      "advance",
      "single",
      "set-a",
      "set-b",
      "set-c",
      "set-d",
    ],
    required: true,
  },
  subject: {
    type: String,
  },
  paperTitle: {
    type: String,
  },
  pageCount: {
    type: Number,
  },
  status: {
    type: String,
    enum: ["uploading", "processing", "completed", "failed", "review_needed"],
    default: "uploading",
  },
  processingProgress: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
  processingError: {
    type: String,
  },
  extractedQuestions: [
    {
      questionNumber: Number,
      questionText: String,
      options: [
        {
          optionId: String,
          text: String,
        },
      ],
      correctAnswer: String,
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
      topic: String,
      explanation: String,
      pageNumber: Number,
      confidenceScore: Number,
      needsReview: {
        type: Boolean,
        default: false,
      },
      userEdited: {
        type: Boolean,
        default: false,
      },
    },
  ],
  totalQuestions: {
    type: Number,
    default: 0,
  },
  verifiedQuestions: {
    type: Number,
    default: 0,
  },
  processingTime: {
    type: Number, // in seconds
  },
  aiModelVersion: {
    type: String,
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
pdfUploadSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

// Indexes for faster queries
pdfUploadSchema.index({ userId: 1, createdAt: -1 });
pdfUploadSchema.index({ status: 1 });
pdfUploadSchema.index({ examType: 1, examYear: -1 });

module.exports = mongoose.model("PDFUpload", pdfUploadSchema);
