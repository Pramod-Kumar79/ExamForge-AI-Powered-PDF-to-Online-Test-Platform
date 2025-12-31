const mongoose = require("mongoose");

const testSessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  pdfUploadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "PDFUpload",
    required: true,
  },
  sessionId: {
    type: String,
    required: true,
    unique: true,
  },
  title: {
    type: String,
    required: true,
  },
  totalQuestions: {
    type: Number,
    required: true,
  },
  totalMarks: {
    type: Number,
    required: true,
  },
  timeLimit: {
    type: Number, // in seconds
    required: true,
  },
  timeRemaining: {
    type: Number, // in seconds
  },
  isPaused: {
    type: Boolean,
    default: false,
  },
  status: {
    type: String,
    enum: ["not_started", "in_progress", "paused", "completed", "abandoned"],
    default: "not_started",
  },
  currentQuestion: {
    type: Number,
    default: 1,
  },
  answers: [
    {
      questionNumber: Number,
      questionId: mongoose.Schema.Types.ObjectId,
      selectedOption: String,
      isCorrect: Boolean,
      timeSpent: Number, // in seconds
      markedForReview: Boolean,
      answeredAt: Date,
    },
  ],
  markedQuestions: [Number],
  startTime: {
    type: Date,
  },
  endTime: {
    type: Date,
  },
  submittedAt: {
    type: Date,
  },
  score: {
    type: Number,
    default: 0,
  },
  accuracy: {
    type: Number,
    min: 0,
    max: 100,
  },
  timePerQuestion: {
    type: Number,
  },
  topicsPerformance: [
    {
      topic: String,
      correct: Number,
      total: Number,
      accuracy: Number,
    },
  ],
  difficultyAnalysis: {
    easy: { correct: Number, total: Number },
    medium: { correct: Number, total: Number },
    hard: { correct: Number, total: Number },
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
testSessionSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

// Calculate score before saving if completed
testSessionSchema.pre("save", function (next) {
  if (this.status === "completed" && this.answers.length > 0) {
    const correctAnswers = this.answers.filter((a) => a.isCorrect).length;
    this.score = correctAnswers * (this.totalMarks / this.totalQuestions);
    this.accuracy = (correctAnswers / this.answers.length) * 100;

    // Calculate time per question
    if (this.startTime && this.endTime) {
      const totalTime = (this.endTime - this.startTime) / 1000;
      this.timePerQuestion = totalTime / this.answers.length;
    }
  }
  next();
});

// Indexes
testSessionSchema.index({ userId: 1, createdAt: -1 });
testSessionSchema.index({ sessionId: 1 });
testSessionSchema.index({ status: 1 });
testSessionSchema.index({ pdfUploadId: 1 });

module.exports = mongoose.model("TestSession", testSessionSchema);
