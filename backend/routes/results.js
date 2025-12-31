const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const TestSession = require("../models/TestSession");
const PDFUpload = require("../models/PDFUpload");
const Question = require("../models/Question");
const UserProgress = require("../models/UserProgress");

// Get test results
router.get("/session/:sessionId", protect, async (req, res) => {
  try {
    const { sessionId } = req.params;

    const testSession = await TestSession.findOne({
      sessionId,
      userId: req.user.id,
    }).populate("pdfUploadId", "originalName examType examYear paperTitle");

    if (!testSession) {
      return res.status(404).json({ error: "Test results not found" });
    }

    // Get questions with user answers
    const questions = await Question.find({
      pdfUploadId: testSession.pdfUploadId,
    }).sort({ questionNumber: 1 });

    // Map user answers to questions
    const questionsWithAnswers = questions.map((question) => {
      const userAnswer = testSession.answers.find(
        (a) => a.questionNumber === question.questionNumber
      );

      return {
        ...question.toObject(),
        userAnswer: userAnswer || null,
        isCorrect: userAnswer ? userAnswer.isCorrect : false,
        timeSpent: userAnswer ? userAnswer.timeSpent : 0,
        markedForReview: userAnswer ? userAnswer.markedForReview : false,
      };
    });

    res.json({
      success: true,
      results: {
        session: testSession,
        questions: questionsWithAnswers,
        summary: {
          totalQuestions: testSession.totalQuestions,
          attempted: testSession.answers.length,
          correct: testSession.answers.filter((a) => a.isCorrect).length,
          score: testSession.score,
          accuracy: testSession.accuracy,
          timePerQuestion: testSession.timePerQuestion,
          timeSpent: testSession.timeLimit - (testSession.timeRemaining || 0),
        },
      },
    });
  } catch (error) {
    console.error("Get results error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Get user's test history
router.get("/history", protect, async (req, res) => {
  try {
    const { page = 1, limit = 10, examType } = req.query;

    const query = { userId: req.user.id, status: "completed" };
    if (examType) {
      // Need to join with PDFUpload to filter by examType
      const pdfUploads = await PDFUpload.find({ examType });
      query.pdfUploadId = { $in: pdfUploads.map((p) => p._id) };
    }

    const tests = await TestSession.find(query)
      .populate("pdfUploadId", "originalName examType examYear")
      .sort({ submittedAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .select(
        "sessionId title score accuracy totalQuestions timePerQuestion submittedAt"
      );

    const total = await TestSession.countDocuments(query);

    res.json({
      success: true,
      tests,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get history error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Get performance analytics
router.get("/analytics", protect, async (req, res) => {
  try {
    const userProgress = await UserProgress.findOne({ userId: req.user.id });

    if (!userProgress) {
      return res.status(404).json({ error: "Progress data not found" });
    }

    // Get recent test sessions for trend analysis
    const recentSessions = await TestSession.find({
      userId: req.user.id,
      status: "completed",
    })
      .sort({ submittedAt: -1 })
      .limit(30)
      .select("score accuracy submittedAt");

    // Calculate trend data
    const trendData = recentSessions
      .sort((a, b) => a.submittedAt - b.submittedAt)
      .map((session) => ({
        date: session.submittedAt.toISOString().split("T")[0],
        score: session.score,
        accuracy: session.accuracy,
      }));

    // Calculate improvement metrics
    let scoreImprovement = 0;
    let accuracyImprovement = 0;

    if (recentSessions.length >= 2) {
      const oldestSession = recentSessions[recentSessions.length - 1];
      const latestSession = recentSessions[0];

      scoreImprovement =
        ((latestSession.score - oldestSession.score) / oldestSession.score) *
        100;
      accuracyImprovement = latestSession.accuracy - oldestSession.accuracy;
    }

    // Get comparison stats (mock data - in production would compare with other users)
    const comparisonStats = {
      percentile: Math.min(85 + Math.random() * 15, 100), // Mock percentile
      averageScore: 65, // Mock average
      topScore: 95, // Mock top score
      usersCount: 10000, // Mock user count
    };

    res.json({
      success: true,
      analytics: {
        stats: userProgress.stats,
        topicPerformance: userProgress.topicPerformance,
        examPerformance: userProgress.examPerformance,
        weakAreas: userProgress.weakAreas,
        goals: userProgress.goals,
        recommendations: userProgress.recommendations,
        trendData,
        improvement: {
          score: scoreImprovement,
          accuracy: accuracyImprovement,
        },
        comparison: comparisonStats,
      },
    });
  } catch (error) {
    console.error("Get analytics error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Get topic-wise performance
router.get("/topics", protect, async (req, res) => {
  try {
    const userProgress = await UserProgress.findOne({ userId: req.user.id });

    if (!userProgress) {
      return res.status(404).json({ error: "Progress data not found" });
    }

    // Sort topics by accuracy (ascending for weak areas first)
    const sortedTopics = [...userProgress.topicPerformance].sort(
      (a, b) => a.accuracy - b.accuracy
    );

    // Get topic recommendations
    const recommendations = sortedTopics
      .filter((topic) => topic.accuracy < 70 && topic.totalAttempted >= 5)
      .slice(0, 5)
      .map((topic) => ({
        topic: topic.topic,
        accuracy: topic.accuracy,
        targetAccuracy: 80,
        questionsNeeded: Math.ceil(((80 - topic.accuracy) / 10) * 20), // Approximate
        priority:
          topic.accuracy < 50 ? "high" : topic.accuracy < 60 ? "medium" : "low",
      }));

    res.json({
      success: true,
      topics: sortedTopics,
      recommendations,
    });
  } catch (error) {
    console.error("Get topics error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Export results as PDF/CSV
router.get("/export/:sessionId", protect, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { format = "json" } = req.query;

    const testSession = await TestSession.findOne({
      sessionId,
      userId: req.user.id,
    }).populate("pdfUploadId", "originalName examType examYear paperTitle");

    if (!testSession) {
      return res.status(404).json({ error: "Test results not found" });
    }

    // Get questions with answers
    const questions = await Question.find({
      pdfUploadId: testSession.pdfUploadId,
    }).sort({ questionNumber: 1 });

    const questionsWithAnswers = questions.map((question) => {
      const userAnswer = testSession.answers.find(
        (a) => a.questionNumber === question.questionNumber
      );

      return {
        questionNumber: question.questionNumber,
        questionText: question.questionText,
        options: question.options.map((opt) => ({
          optionId: opt.optionId,
          text: opt.text,
          isCorrect: opt.isCorrect,
        })),
        correctAnswer: question.correctAnswer,
        userAnswer: userAnswer ? userAnswer.selectedOption : null,
        isCorrect: userAnswer ? userAnswer.isCorrect : false,
        timeSpent: userAnswer ? userAnswer.timeSpent : 0,
        explanation: question.explanation,
        topic: question.topic,
        difficulty: question.difficulty,
      };
    });

    const results = {
      testInfo: {
        title: testSession.title,
        sessionId: testSession.sessionId,
        date: testSession.submittedAt,
        duration: testSession.timeLimit - (testSession.timeRemaining || 0),
        totalQuestions: testSession.totalQuestions,
        attempted: testSession.answers.length,
      },
      scores: {
        totalScore: testSession.score,
        accuracy: testSession.accuracy,
        correctAnswers: testSession.answers.filter((a) => a.isCorrect).length,
        timePerQuestion: testSession.timePerQuestion,
      },
      performance: {
        topics: testSession.topicsPerformance,
        difficulty: testSession.difficultyAnalysis,
      },
      questions: questionsWithAnswers,
    };

    if (format === "csv") {
      // Convert to CSV
      let csv =
        "Question Number,Question Text,Your Answer,Correct Answer,Is Correct,Time Spent (s),Topic,Difficulty\n";

      questionsWithAnswers.forEach((q) => {
        csv += `"${q.questionNumber}","${q.questionText.replace(
          /"/g,
          '""'
        )}","${q.userAnswer || "Not Attempted"}","${q.correctAnswer}","${
          q.isCorrect
        }","${q.timeSpent}","${q.topic || ""}","${q.difficulty}"\n`;
      });

      res.header("Content-Type", "text/csv");
      res.header(
        "Content-Disposition",
        `attachment; filename=test-results-${sessionId}.csv`
      );
      return res.send(csv);
    } else if (format === "pdf") {
      // In production, use a PDF generation library like pdfkit or puppeteer
      // For now, return JSON with a note
      return res.json({
        success: true,
        message: "PDF export not implemented in demo. Use JSON or CSV format.",
        results,
      });
    }

    // Default: JSON format
    res.json({
      success: true,
      results,
    });
  } catch (error) {
    console.error("Export results error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
