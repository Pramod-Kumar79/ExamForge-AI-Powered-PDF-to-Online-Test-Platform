const mongoose = require("mongoose");

const userProgressSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
  },
  stats: {
    totalTestsTaken: {
      type: Number,
      default: 0,
    },
    totalQuestionsAttempted: {
      type: Number,
      default: 0,
    },
    totalCorrectAnswers: {
      type: Number,
      default: 0,
    },
    totalTimeSpent: {
      type: Number, // in seconds
      default: 0,
    },
    averageScore: {
      type: Number,
      default: 0,
    },
    averageAccuracy: {
      type: Number,
      default: 0,
    },
    currentStreak: {
      type: Number,
      default: 0,
    },
    longestStreak: {
      type: Number,
      default: 0,
    },
    lastTestDate: {
      type: Date,
    },
  },
  topicPerformance: [
    {
      topic: String,
      totalAttempted: Number,
      totalCorrect: Number,
      accuracy: Number,
      lastPracticed: Date,
    },
  ],
  examPerformance: {
    upsc: { tests: Number, averageScore: Number },
    ssc: { tests: Number, averageScore: Number },
    jee: { tests: Number, averageScore: Number },
    neet: { tests: Number, averageScore: Number },
    banking: { tests: Number, averageScore: Number },
    cat: { tests: Number, averageScore: Number },
  },
  weakAreas: [
    {
      topic: String,
      accuracy: Number,
      improvementPriority: {
        type: String,
        enum: ["low", "medium", "high"],
        default: "medium",
      },
      suggestedActions: [String],
    },
  ],
  goals: [
    {
      title: String,
      examType: String,
      target: Number, // number of questions or tests
      current: Number,
      unit: {
        type: String,
        enum: ["questions", "tests", "minutes"],
      },
      deadline: Date,
      priority: {
        type: String,
        enum: ["low", "medium", "high"],
        default: "medium",
      },
      status: {
        type: String,
        enum: ["active", "completed", "failed"],
        default: "active",
      },
      createdAt: Date,
    },
  ],
  dailyActivity: [
    {
      date: Date,
      testsTaken: Number,
      questionsAttempted: Number,
      timeSpent: Number,
      streakMaintained: Boolean,
    },
  ],
  recommendations: [
    {
      type: {
        type: String,
        enum: ["topic", "time_management", "difficulty", "consistency"],
      },
      message: String,
      action: String,
      priority: Number,
      isRead: {
        type: Boolean,
        default: false,
      },
      createdAt: Date,
    },
  ],
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
userProgressSchema.pre("save", function (next) {
  this.updatedAt = Date.now();

  // Update average accuracy
  if (this.stats.totalQuestionsAttempted > 0) {
    this.stats.averageAccuracy =
      (this.stats.totalCorrectAnswers / this.stats.totalQuestionsAttempted) *
      100;
  }

  next();
});

// Indexes
userProgressSchema.index({ userId: 1 });
userProgressSchema.index({ "weakAreas.improvementPriority": 1 });
userProgressSchema.index({ "goals.status": 1, "goals.deadline": 1 });

module.exports = mongoose.model("UserProgress", userProgressSchema);
