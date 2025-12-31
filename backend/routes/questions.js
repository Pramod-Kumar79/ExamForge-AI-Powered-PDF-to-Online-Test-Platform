const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const PDFUpload = require("../models/PDFUpload");
const Question = require("../models/Question");

// Get questions from a PDF upload
router.get("/pdf/:pdfId", protect, async (req, res) => {
  try {
    const { pdfId } = req.params;
    const { status, topic, difficulty } = req.query;

    // Verify PDF belongs to user
    const pdfUpload = await PDFUpload.findOne({
      _id: pdfId,
      userId: req.user.id,
    });

    if (!pdfUpload) {
      return res.status(404).json({ error: "PDF not found" });
    }

    const query = { pdfUploadId: pdfId };
    if (status) query.status = status;
    if (topic) query.topic = topic;
    if (difficulty) query.difficulty = difficulty;

    const questions = await Question.find(query).sort({ questionNumber: 1 });

    res.json({
      success: true,
      questions,
      pdfInfo: {
        title: pdfUpload.paperTitle,
        examType: pdfUpload.examType,
        examYear: pdfUpload.examYear,
        totalQuestions: pdfUpload.totalQuestions,
      },
    });
  } catch (error) {
    console.error("Get questions error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Update a question
router.put("/:id", protect, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Find question and verify ownership
    const question = await Question.findOne({ _id: id });
    if (!question) {
      return res.status(404).json({ error: "Question not found" });
    }

    const pdfUpload = await PDFUpload.findOne({
      _id: question.pdfUploadId,
      userId: req.user.id,
    });

    if (!pdfUpload) {
      return res.status(403).json({ error: "Not authorized" });
    }

    // Update question
    Object.keys(updates).forEach((key) => {
      question[key] = updates[key];
    });

    question.status = question.userEdited ? "edited" : "verified";
    question.userEdited = true;

    await question.save();

    // Update PDF upload stats
    const verifiedCount = await Question.countDocuments({
      pdfUploadId: pdfUpload._id,
      status: { $in: ["verified", "edited"] },
    });

    await PDFUpload.findByIdAndUpdate(pdfUpload._id, {
      verifiedQuestions: verifiedCount,
    });

    res.json({
      success: true,
      question,
    });
  } catch (error) {
    console.error("Update question error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Bulk update questions
router.put("/bulk/update", protect, async (req, res) => {
  try {
    const { questionIds, updates } = req.body;

    if (
      !questionIds ||
      !Array.isArray(questionIds) ||
      questionIds.length === 0
    ) {
      return res.status(400).json({ error: "No questions specified" });
    }

    // Verify all questions belong to user
    const questions = await Question.find({ _id: { $in: questionIds } });

    const pdfUploadIds = [
      ...new Set(questions.map((q) => q.pdfUploadId.toString())),
    ];

    for (const pdfUploadId of pdfUploadIds) {
      const pdfUpload = await PDFUpload.findOne({
        _id: pdfUploadId,
        userId: req.user.id,
      });

      if (!pdfUpload) {
        return res
          .status(403)
          .json({ error: "Not authorized for some questions" });
      }
    }

    // Update questions
    await Question.updateMany(
      { _id: { $in: questionIds } },
      {
        ...updates,
        status: "verified",
        userEdited: true,
        updatedAt: Date.now(),
      }
    );

    // Update PDF upload stats for each affected PDF
    for (const pdfUploadId of pdfUploadIds) {
      const verifiedCount = await Question.countDocuments({
        pdfUploadId,
        status: { $in: ["verified", "edited"] },
      });

      await PDFUpload.findByIdAndUpdate(pdfUploadId, {
        verifiedQuestions: verifiedCount,
      });
    }

    res.json({
      success: true,
      message: `${questionIds.length} questions updated successfully`,
    });
  } catch (error) {
    console.error("Bulk update error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Delete questions
router.delete("/bulk/delete", protect, async (req, res) => {
  try {
    const { questionIds } = req.body;

    if (
      !questionIds ||
      !Array.isArray(questionIds) ||
      questionIds.length === 0
    ) {
      return res.status(400).json({ error: "No questions specified" });
    }

    // Verify all questions belong to user
    const questions = await Question.find({ _id: { $in: questionIds } });

    const pdfUploadIds = [
      ...new Set(questions.map((q) => q.pdfUploadId.toString())),
    ];

    for (const pdfUploadId of pdfUploadIds) {
      const pdfUpload = await PDFUpload.findOne({
        _id: pdfUploadId,
        userId: req.user.id,
      });

      if (!pdfUpload) {
        return res
          .status(403)
          .json({ error: "Not authorized for some questions" });
      }
    }

    // Delete questions
    await Question.deleteMany({ _id: { $in: questionIds } });

    // Update PDF upload stats for each affected PDF
    for (const pdfUploadId of pdfUploadIds) {
      const remainingQuestions = await Question.countDocuments({ pdfUploadId });
      const verifiedCount = await Question.countDocuments({
        pdfUploadId,
        status: { $in: ["verified", "edited"] },
      });

      await PDFUpload.findByIdAndUpdate(pdfUploadId, {
        totalQuestions: remainingQuestions,
        verifiedQuestions: verifiedCount,
      });
    }

    res.json({
      success: true,
      message: `${questionIds.length} questions deleted successfully`,
    });
  } catch (error) {
    console.error("Bulk delete error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Get topics from a PDF
router.get("/pdf/:pdfId/topics", protect, async (req, res) => {
  try {
    const { pdfId } = req.params;

    const pdfUpload = await PDFUpload.findOne({
      _id: pdfId,
      userId: req.user.id,
    });

    if (!pdfUpload) {
      return res.status(404).json({ error: "PDF not found" });
    }

    const topics = await Question.aggregate([
      { $match: { pdfUploadId: pdfUpload._id } },
      {
        $group: {
          _id: "$topic",
          count: { $sum: 1 },
          verified: {
            $sum: {
              $cond: [{ $in: ["$status", ["verified", "edited"]] }, 1, 0],
            },
          },
        },
      },
      {
        $project: {
          topic: "$_id",
          count: 1,
          verified: 1,
          _id: 0,
        },
      },
      { $sort: { count: -1 } },
    ]);

    res.json({
      success: true,
      topics: topics.filter((t) => t.topic), // Remove null/undefined
    });
  } catch (error) {
    console.error("Get topics error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
