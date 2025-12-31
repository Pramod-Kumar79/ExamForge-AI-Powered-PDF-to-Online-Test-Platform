const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const PDFUpload = require("../models/PDFUpload");
const Question = require("../models/Question");
const TestSession = require("../models/TestSession");
const UserProgress = require("../models/UserProgress");

// Start a new test session
router.post("/start", protect, async (req, res) => {
  try {
    const { pdfId, timeLimit } = req.body;

    // Verify PDF exists and belongs to user
    const pdfUpload = await PDFUpload.findOne({
      _id: pdfId,
      userId: req.user.id,
      status: "completed",
    });

    if (!pdfUpload) {
      return res.status(404).json({
        error: "PDF not found or not ready for testing",
      });
    }

    // Get questions for this PDF
    const questions = await Question.find({
      pdfUploadId: pdfId,
      status: { $in: ["verified", "edited"] },
    }).sort({ questionNumber: 1 });

    if (questions.length === 0) {
      return res.status(400).json({
        error: "No verified questions available for testing",
      });
    }

    // Calculate total marks
    const totalMarks = questions.reduce((sum, q) => sum + q.marks, 0);

    // Generate session ID
    const sessionId = `test_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    // Create test session
    const testSession = await TestSession.create({
      userId: req.user.id,
      pdfUploadId: pdfId,
      sessionId,
      title: pdfUpload.paperTitle || `Test from ${pdfUpload.originalName}`,
      totalQuestions: questions.length,
      totalMarks,
      timeLimit: timeLimit || 3600, // Default 1 hour
      timeRemaining: timeLimit || 3600,
      status: "not_started",
      currentQuestion: 1,
      answers: [],
      markedQuestions: [],
      startTime: null,
      endTime: null,
    });

    res.json({
      success: true,
      session: {
        id: testSession._id,
        sessionId: testSession.sessionId,
        title: testSession.title,
        totalQuestions: testSession.totalQuestions,
        totalMarks: testSession.totalMarks,
        timeLimit: testSession.timeLimit,
        currentQuestion: testSession.currentQuestion,
      },
      questions: questions.map((q) => ({
        id: q._id,
        questionNumber: q.questionNumber,
        questionText: q.questionText,
        options: q.options.map((opt) => ({
          optionId: opt.optionId,
          text: opt.text,
        })),
        questionType: q.questionType,
        difficulty: q.difficulty,
        topic: q.topic,
        marks: q.marks,
      })),
    });
  } catch (error) {
    console.error("Start test error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Get test session
router.get("/session/:sessionId", protect, async (req, res) => {
  try {
    const { sessionId } = req.params;

    const testSession = await TestSession.findOne({
      sessionId,
      userId: req.user.id,
    });

    if (!testSession) {
      return res.status(404).json({ error: "Test session not found" });
    }

    // Get questions for this session
    const questions = await Question.find({
      pdfUploadId: testSession.pdfUploadId,
      status: { $in: ["verified", "edited"] },
    }).sort({ questionNumber: 1 });

    res.json({
      success: true,
      session: testSession,
      questions: questions.map((q) => ({
        id: q._id,
        questionNumber: q.questionNumber,
        questionText: q.questionText,
        options: q.options.map((opt) => ({
          optionId: opt.optionId,
          text: opt.text,
        })),
        questionType: q.questionType,
        difficulty: q.difficulty,
        topic: q.topic,
        marks: q.marks,
      })),
    });
  } catch (error) {
    console.error("Get session error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Update test progress
router.put("/session/:sessionId/progress", protect, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const {
      currentQuestion,
      answers,
      markedQuestions,
      timeRemaining,
      isPaused,
    } = req.body;

    const testSession = await TestSession.findOne({
      sessionId,
      userId: req.user.id,
    });

    if (!testSession) {
      return res.status(404).json({ error: "Test session not found" });
    }

    // Update session
    const updates = {};
    if (currentQuestion !== undefined)
      updates.currentQuestion = currentQuestion;
    if (answers !== undefined) updates.answers = answers;
    if (markedQuestions !== undefined)
      updates.markedQuestions = markedQuestions;
    if (timeRemaining !== undefined) updates.timeRemaining = timeRemaining;
    if (isPaused !== undefined) updates.isPaused = isPaused;

    // Start timer if not started
    if (testSession.status === "not_started" && currentQuestion) {
      updates.status = "in_progress";
      updates.startTime = new Date();
    }

    // Check if test should be auto-submitted (time up)
    if (timeRemaining <= 0) {
      updates.status = "completed";
      updates.endTime = new Date();
      updates.submittedAt = new Date();
    }

    const updatedSession = await TestSession.findByIdAndUpdate(
      testSession._id,
      updates,
      { new: true }
    );

    // If test completed, calculate results
    if (updatedSession.status === "completed") {
      await calculateTestResults(updatedSession);
    }

    res.json({
      success: true,
      session: updatedSession,
    });
  } catch (error) {
    console.error("Update progress error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Submit answer for a question
router.post("/session/:sessionId/answer", protect, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { questionNumber, selectedOption, timeSpent, markedForReview } =
      req.body;

    const testSession = await TestSession.findOne({
      sessionId,
      userId: req.user.id,
    });

    if (!testSession) {
      return res.status(404).json({ error: "Test session not found" });
    }

    // Get question to check correct answer
    const question = await Question.findOne({
      pdfUploadId: testSession.pdfUploadId,
      questionNumber,
    });

    if (!question) {
      return res.status(404).json({ error: "Question not found" });
    }

    // Check if answer is correct
    const isCorrect = selectedOption === question.correctAnswer;

    // Update or add answer
    const answerIndex = testSession.answers.findIndex(
      (a) => a.questionNumber === questionNumber
    );

    const answerData = {
      questionNumber,
      questionId: question._id,
      selectedOption,
      isCorrect,
      timeSpent: timeSpent || 0,
      markedForReview: markedForReview || false,
      answeredAt: new Date(),
    };

    if (answerIndex >= 0) {
      testSession.answers[answerIndex] = answerData;
    } else {
      testSession.answers.push(answerData);
    }

    // Update marked questions
    if (markedForReview) {
      if (!testSession.markedQuestions.includes(questionNumber)) {
        testSession.markedQuestions.push(questionNumber);
      }
    } else {
      testSession.markedQuestions = testSession.markedQuestions.filter(
        (q) => q !== questionNumber
      );
    }

    await testSession.save();

    res.json({
      success: true,
      answer: answerData,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
    });
  } catch (error) {
    console.error("Submit answer error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Submit entire test
router.post("/session/:sessionId/submit", protect, async (req, res) => {
  try {
    const { sessionId } = req.params;

    const testSession = await TestSession.findOne({
      sessionId,
      userId: req.user.id,
    });

    if (!testSession) {
      return res.status(404).json({ error: "Test session not found" });
    }

    // Update test session
    testSession.status = "completed";
    testSession.endTime = new Date();
    testSession.submittedAt = new Date();

    await testSession.save();

    // Calculate results
    await calculateTestResults(testSession);

    res.json({
      success: true,
      message: "Test submitted successfully",
      sessionId: testSession._id,
    });
  } catch (error) {
    console.error("Submit test error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Helper function to calculate test results
async function calculateTestResults(testSession) {
  try {
    // Get all questions for this test
    const questions = await Question.find({
      pdfUploadId: testSession.pdfUploadId,
    });

    // Create map for quick lookup
    const questionMap = {};
    questions.forEach((q) => {
      questionMap[q.questionNumber] = q;
    });

    // Calculate detailed results
    let correctCount = 0;
    let totalTimeSpent = 0;
    const topicsPerformance = {};
    const difficultyAnalysis = {
      easy: { correct: 0, total: 0 },
      medium: { correct: 0, total: 0 },
      hard: { correct: 0, total: 0 },
    };

    testSession.answers.forEach((answer) => {
      const question = questionMap[answer.questionNumber];
      if (!question) return;

      // Count correct answers
      if (answer.isCorrect) {
        correctCount++;
      }

      // Track time
      totalTimeSpent += answer.timeSpent || 0;

      // Track topic performance
      if (question.topic) {
        if (!topicsPerformance[question.topic]) {
          topicsPerformance[question.topic] = {
            correct: 0,
            total: 0,
          };
        }
        topicsPerformance[question.topic].total++;
        if (answer.isCorrect) {
          topicsPerformance[question.topic].correct++;
        }
      }

      // Track difficulty performance
      if (question.difficulty && difficultyAnalysis[question.difficulty]) {
        difficultyAnalysis[question.difficulty].total++;
        if (answer.isCorrect) {
          difficultyAnalysis[question.difficulty].correct++;
        }
      }
    });

    // Calculate scores
    const score =
      correctCount * (testSession.totalMarks / testSession.totalQuestions);
    const accuracy =
      testSession.answers.length > 0
        ? (correctCount / testSession.answers.length) * 100
        : 0;
    const timePerQuestion =
      testSession.answers.length > 0
        ? totalTimeSpent / testSession.answers.length
        : 0;

    // Convert topics performance to array
    const topicsArray = Object.keys(topicsPerformance).map((topic) => ({
      topic,
      correct: topicsPerformance[topic].correct,
      total: topicsPerformance[topic].total,
      accuracy:
        (topicsPerformance[topic].correct / topicsPerformance[topic].total) *
        100,
    }));

    // Update test session with results
    testSession.score = score;
    testSession.accuracy = accuracy;
    testSession.timePerQuestion = timePerQuestion;
    testSession.topicsPerformance = topicsArray;
    testSession.difficultyAnalysis = difficultyAnalysis;

    await testSession.save();

    // Update user progress
    await updateUserProgress(testSession.userId, testSession);
  } catch (error) {
    console.error("Calculate results error:", error);
  }
}

// Helper function to update user progress
async function updateUserProgress(userId, testSession) {
  try {
    let userProgress = await UserProgress.findOne({ userId });

    if (!userProgress) {
      userProgress = await UserProgress.create({ userId });
    }

    // Update basic stats
    userProgress.stats.totalTestsTaken += 1;
    userProgress.stats.totalQuestionsAttempted += testSession.answers.length;
    userProgress.stats.totalCorrectAnswers += testSession.answers.filter(
      (a) => a.isCorrect
    ).length;
    userProgress.stats.totalTimeSpent +=
      testSession.timeLimit - (testSession.timeRemaining || 0);
    userProgress.stats.lastTestDate = new Date();

    // Calculate new average score
    const totalScore =
      userProgress.stats.averageScore *
        (userProgress.stats.totalTestsTaken - 1) +
      testSession.score;
    userProgress.stats.averageScore =
      totalScore / userProgress.stats.totalTestsTaken;

    // Update streak
    const today = new Date().toDateString();
    const lastActive = userProgress.stats.lastTestDate
      ? new Date(userProgress.stats.lastTestDate).toDateString()
      : null;

    if (lastActive === today) {
      // Already updated today
    } else if (lastActive === new Date(Date.now() - 86400000).toDateString()) {
      // Consecutive day
      userProgress.stats.currentStreak += 1;
      userProgress.stats.longestStreak = Math.max(
        userProgress.stats.longestStreak,
        userProgress.stats.currentStreak
      );
    } else {
      // Broken streak
      userProgress.stats.currentStreak = 1;
    }

    // Update topic performance
    testSession.topicsPerformance.forEach((topicPerf) => {
      const existingTopic = userProgress.topicPerformance.find(
        (tp) => tp.topic === topicPerf.topic
      );

      if (existingTopic) {
        existingTopic.totalAttempted += topicPerf.total;
        existingTopic.totalCorrect += topicPerf.correct;
        existingTopic.accuracy =
          (existingTopic.totalCorrect / existingTopic.totalAttempted) * 100;
        existingTopic.lastPracticed = new Date();
      } else {
        userProgress.topicPerformance.push({
          topic: topicPerf.topic,
          totalAttempted: topicPerf.total,
          totalCorrect: topicPerf.correct,
          accuracy: topicPerf.accuracy,
          lastPracticed: new Date(),
        });
      }
    });

    // Update exam performance
    const pdfUpload = await PDFUpload.findById(testSession.pdfUploadId);
    if (pdfUpload && pdfUpload.examType) {
      if (!userProgress.examPerformance[pdfUpload.examType]) {
        userProgress.examPerformance[pdfUpload.examType] = {
          tests: 0,
          averageScore: 0,
        };
      }

      const examStats = userProgress.examPerformance[pdfUpload.examType];
      const totalScore =
        examStats.averageScore * examStats.tests + testSession.score;
      examStats.tests += 1;
      examStats.averageScore = totalScore / examStats.tests;
    }

    // Identify weak areas (topics with accuracy < 60%)
    userProgress.weakAreas = userProgress.topicPerformance
      .filter((tp) => tp.accuracy < 60 && tp.totalAttempted >= 5)
      .map((tp) => ({
        topic: tp.topic,
        accuracy: tp.accuracy,
        improvementPriority:
          tp.accuracy < 40 ? "high" : tp.accuracy < 50 ? "medium" : "low",
        suggestedActions: [
          `Practice ${
            Math.ceil((60 - tp.accuracy) / 10) * 10
          } more questions on ${tp.topic}`,
          `Review explanations for incorrect answers`,
          `Focus on ${tp.topic} in your next study session`,
        ],
      }))
      .slice(0, 5); // Keep top 5 weak areas

    // Add daily activity
    const todayActivity = userProgress.dailyActivity.find(
      (activity) => activity.date.toDateString() === new Date().toDateString()
    );

    if (todayActivity) {
      todayActivity.testsTaken += 1;
      todayActivity.questionsAttempted += testSession.answers.length;
      todayActivity.timeSpent +=
        testSession.timeLimit - (testSession.timeRemaining || 0);
      todayActivity.streakMaintained = userProgress.stats.currentStreak > 1;
    } else {
      userProgress.dailyActivity.push({
        date: new Date(),
        testsTaken: 1,
        questionsAttempted: testSession.answers.length,
        timeSpent: testSession.timeLimit - (testSession.timeRemaining || 0),
        streakMaintained: userProgress.stats.currentStreak > 1,
      });

      // Keep only last 30 days of activity
      if (userProgress.dailyActivity.length > 30) {
        userProgress.dailyActivity = userProgress.dailyActivity.slice(-30);
      }
    }

    // Generate recommendations
    const newRecommendations = [];

    // Check for topics needing improvement
    userProgress.weakAreas.forEach((weakArea) => {
      newRecommendations.push({
        type: "topic",
        message: `Your accuracy in ${
          weakArea.topic
        } is ${weakArea.accuracy.toFixed(1)}%. Focus on improving this topic.`,
        action: `/practice/topic/${encodeURIComponent(weakArea.topic)}`,
        priority:
          weakArea.improvementPriority === "high"
            ? 1
            : weakArea.improvementPriority === "medium"
            ? 2
            : 3,
        createdAt: new Date(),
      });
    });

    // Check for time management issues
    if (testSession.timePerQuestion > 120) {
      newRecommendations.push({
        type: "time_management",
        message: `You're spending ${Math.round(
          testSession.timePerQuestion
        )} seconds per question on average. Try to improve your speed.`,
        action: "/practice/speed",
        priority: 2,
        createdAt: new Date(),
      });
    }

    // Add new recommendations
    userProgress.recommendations = [
      ...newRecommendations,
      ...userProgress.recommendations,
    ].slice(0, 10); // Keep only 10 most recent recommendations

    await userProgress.save();
  } catch (error) {
    console.error("Update user progress error:", error);
  }
}

module.exports = router;
