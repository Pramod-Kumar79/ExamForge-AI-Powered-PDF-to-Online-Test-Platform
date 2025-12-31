const PDFUpload = require("../models/PDFUpload");
const Question = require("../models/Question");
const axios = require("axios");

// Simple PDF text extraction (using pdf-parse)
const pdfParse = require("pdf-parse");

// Process PDF and extract questions
const processPDF = async (pdfUploadId, pdfBuffer) => {
  try {
    // Update status to processing
    await PDFUpload.findByIdAndUpdate(pdfUploadId, {
      status: "processing",
      processingProgress: 10,
      updatedAt: Date.now(),
    });

    // Extract text from PDF
    console.log(`Extracting text from PDF ${pdfUploadId}...`);
    const data = await pdfParse(pdfBuffer);
    const text = data.text;

    await PDFUpload.findByIdAndUpdate(pdfUploadId, {
      processingProgress: 30,
      pageCount: data.numpages,
    });

    // For demo purposes, we'll use a simple rule-based extractor
    // In production, this would call an AI service
    console.log(`Detecting questions in PDF ${pdfUploadId}...`);
    const extractedQuestions = extractQuestionsWithRules(text);

    await PDFUpload.findByIdAndUpdate(pdfUploadId, {
      processingProgress: 70,
    });

    // Save questions to database
    console.log(
      `Saving ${extractedQuestions.length} questions for PDF ${pdfUploadId}...`
    );

    const pdfUpload = await PDFUpload.findById(pdfUploadId);

    for (const [index, q] of extractedQuestions.entries()) {
      const question = new Question({
        pdfUploadId: pdfUpload._id,
        userId: pdfUpload.userId,
        questionNumber: index + 1,
        originalQuestionText: q.questionText,
        questionText: q.questionText,
        options: q.options.map((opt) => ({
          optionId: opt.optionId,
          originalText: opt.text,
          text: opt.text,
          isCorrect: opt.isCorrect || false,
        })),
        correctAnswer: q.correctAnswer,
        questionType: q.questionType || "mcq",
        difficulty: q.difficulty || "medium",
        topic: q.topic || "",
        explanation: q.explanation || "",
        pageNumber: q.pageNumber || 1,
        aiConfidence: q.confidence || 0.8,
        status: "extracted",
        tags: q.tags || [],
      });

      await question.save();
    }

    // Update PDF upload with results
    await PDFUpload.findByIdAndUpdate(pdfUploadId, {
      status: "completed",
      processingProgress: 100,
      totalQuestions: extractedQuestions.length,
      verifiedQuestions: 0,
      processingTime: Math.floor((Date.now() - pdfUpload.createdAt) / 1000),
      aiModelVersion: "rule-based-v1",
      updatedAt: Date.now(),
    });

    console.log(`PDF ${pdfUploadId} processing completed successfully`);
  } catch (error) {
    console.error(`Error processing PDF ${pdfUploadId}:`, error);

    await PDFUpload.findByIdAndUpdate(pdfUploadId, {
      status: "failed",
      processingError: error.message,
      updatedAt: Date.now(),
    });

    throw error;
  }
};

// Simple rule-based question extractor (for demo)
// In production, replace with AI/ML model
const extractQuestionsWithRules = (text) => {
  const questions = [];

  // Split text into lines
  const lines = text.split("\n");

  // Simple patterns for question detection
  const questionPatterns = [
    /^\d+[\.\)]\s+(.+?)\?/i, // 1. Question text?
    /^Q\d+[:\.]\s+(.+?)\?/i, // Q1: Question text?
    /^\(\d+\)\s+(.+?)\?/i, // (1) Question text?
    /^\d+\.\s+(.+?)\?/i, // 1. Question text? (without space)
  ];

  // Patterns for options
  const optionPatterns = [
    /^[A-D][\.\)]\s+(.+)/i, // A) Option text
    /^\([A-D]\)\s+(.+)/i, // (A) Option text
    /^[A-D]\.\s+(.+)/i, // A. Option text
  ];

  let currentQuestion = null;
  let collectingOptions = false;
  let optionCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip empty lines
    if (!line) continue;

    // Check if line is a question
    if (!currentQuestion) {
      for (const pattern of questionPatterns) {
        const match = line.match(pattern);
        if (match) {
          currentQuestion = {
            questionText: match[1].trim(),
            options: [],
            questionType: "mcq",
            difficulty: "medium",
            confidence: 0.7,
          };
          collectingOptions = false;
          optionCount = 0;
          break;
        }
      }
    }
    // Check if line is an option
    else if (optionCount < 4) {
      // Max 4 options for demo
      for (const pattern of optionPatterns) {
        const match = line.match(pattern);
        if (match) {
          const optionId = line[0].toUpperCase(); // A, B, C, D
          const optionText = match[1].trim();

          currentQuestion.options.push({
            optionId,
            text: optionText,
            isCorrect: false, // Will need answer key detection
          });

          optionCount++;
          collectingOptions = true;
          break;
        }
      }

      // If we didn't find an option pattern but were collecting options,
      // maybe the option text spans multiple lines
      if (collectingOptions && !line.match(/^[A-D][\.\)\s]/i)) {
        const lastOption =
          currentQuestion.options[currentQuestion.options.length - 1];
        if (lastOption) {
          lastOption.text += " " + line;
        }
      }
    }

    // If we have a question with options, finalize it
    if (
      currentQuestion &&
      currentQuestion.options.length >= 2 &&
      optionCount >= 4
    ) {
      // Set a random correct answer for demo
      const correctOption =
        currentQuestion.options[
          Math.floor(Math.random() * currentQuestion.options.length)
        ];
      currentQuestion.correctAnswer = correctOption.optionId;
      correctOption.isCorrect = true;

      // Add explanation for demo
      currentQuestion.explanation = `This is a sample explanation for the question. The correct answer is ${correctOption.optionId} because ${correctOption.text}.`;

      // Add topic based on keywords
      const topicKeywords = {
        history: ["king", "battle", "war", "empire", "century"],
        geography: ["river", "mountain", "country", "capital", "climate"],
        science: ["chemical", "physics", "biology", "atom", "energy"],
        math: ["calculate", "equation", "number", "sum", "multiply"],
      };

      for (const [topic, keywords] of Object.entries(topicKeywords)) {
        if (
          keywords.some((keyword) =>
            currentQuestion.questionText.toLowerCase().includes(keyword)
          )
        ) {
          currentQuestion.topic =
            topic.charAt(0).toUpperCase() + topic.slice(1);
          break;
        }
      }

      if (!currentQuestion.topic) {
        currentQuestion.topic = "General Knowledge";
      }

      questions.push(currentQuestion);
      currentQuestion = null;
      collectingOptions = false;
      optionCount = 0;
    }
  }

  // If we reached end of file with a question, add it
  if (currentQuestion && currentQuestion.options.length >= 2) {
    // Set a random correct answer
    const correctOption =
      currentQuestion.options[
        Math.floor(Math.random() * currentQuestion.options.length)
      ];
    currentQuestion.correctAnswer = correctOption.optionId;
    correctOption.isCorrect = true;

    questions.push(currentQuestion);
  }

  // Limit to 20 questions for demo
  return questions.slice(0, 20).map((q, index) => ({
    ...q,
    questionNumber: index + 1,
    pageNumber: Math.floor(index / 5) + 1, // Distribute across pages
  }));
};

// Call external AI service for better extraction (future implementation)
const callAIExtractionService = async (text, pdfMetadata) => {
  try {
    // This would call your Python AI service
    const response = await axios.post(
      process.env.AI_PROCESSOR_URL + "/extract",
      {
        text,
        metadata: pdfMetadata,
      }
    );

    return response.data.questions;
  } catch (error) {
    console.error("AI extraction service error:", error);
    // Fall back to rule-based extraction
    return extractQuestionsWithRules(text);
  }
};

module.exports = {
  processPDF,
  extractQuestionsWithRules,
  callAIExtractionService,
};
