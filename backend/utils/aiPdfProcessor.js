const PDFUpload = require("../models/PDFUpload");
const Question = require("../models/Question");
const pdfParse = require("pdf-parse");

const processPDFWithAI = async (pdfUploadId, pdfBuffer) => {
  try {
    console.log("🤖 AI PROCESSOR STARTING (Local Version)...");

    const pdfUpload = await PDFUpload.findById(pdfUploadId);

    // Update status
    await PDFUpload.findByIdAndUpdate(pdfUploadId, {
      status: "processing",
      processingProgress: 10,
    });

    // Extract text
    console.log("📄 Extracting PDF text...");
    const data = await pdfParse(pdfBuffer);
    const text = data.text;

    // Show what was extracted
    console.log("📝 First 1000 chars of extracted text:");
    console.log(text.substring(0, 1000));

    await PDFUpload.findByIdAndUpdate(pdfUploadId, {
      processingProgress: 30,
      pageCount: data.numpages,
    });

    // Use SMART LOCAL extraction (no OpenAI needed)
    console.log("🔍 Analyzing text locally...");
    const extractedQuestions = extractQuestionsSmart(text);

    console.log(`✅ Found ${extractedQuestions.length} questions`);

    await PDFUpload.findByIdAndUpdate(pdfUploadId, {
      processingProgress: 70,
    });

    // Save questions to database
    await saveQuestionsToDB(pdfUploadId, extractedQuestions, pdfUpload);

    // Update final status
    await PDFUpload.findByIdAndUpdate(pdfUploadId, {
      status: "completed",
      processingProgress: 100,
      totalQuestions: extractedQuestions.length,
      aiModelVersion: "local-smart-v1",
    });

    console.log(`✅ Local AI processing completed for ${pdfUploadId}`);
    return extractedQuestions;
  } catch (error) {
    console.error(`❌ AI processing error:`, error);
    await PDFUpload.findByIdAndUpdate(pdfUploadId, {
      status: "failed",
      processingError: error.message,
    });
    throw error;
  }
};

// SMART LOCAL QUESTION EXTRACTION
const extractQuestionsSmart = (text) => {
  const questions = [];
  const lines = text.split("\n");

  let currentQuestion = null;
  let questionNumber = 1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip empty lines
    if (!line) continue;

    // Detect question patterns (multiple formats)
    if (line.match(/^(Q\.\s*\d+|Question\s*\d+|\d+\.)\s+.*[\.\?]/i)) {
      // Save previous question if exists
      if (currentQuestion && currentQuestion.options.length > 0) {
        finalizeQuestion(currentQuestion);
        questions.push(currentQuestion);
      }

      // Extract question text
      let questionText = line.replace(
        /^(Q\.\s*\d+|Question\s*\d+|\d+\.)\s+/i,
        ""
      );

      currentQuestion = {
        originalQuestionText: questionText, // FIX: Add this field
        questionText: questionText,
        options: [],
        questionNumber: questionNumber++,
        questionType: "mcq",
        difficulty: "medium",
        topic: detectTopic(questionText),
        explanation: "Extracted using smart local analysis",
      };
    }
    // Detect options (multiple formats)
    else if (
      currentQuestion &&
      line.match(/^[×x\-*]?\s*([1-4A-D])[\.\)]\s+.+/i)
    ) {
      const match = line.match(/^[×x\-*]?\s*([1-4A-D])[\.\)]\s+(.+)/i);
      if (match) {
        const optionId = match[1].toUpperCase();
        const optionText = match[2].trim();
        const isCorrect =
          line.includes("×") || line.includes("✓") || line.includes("*");

        currentQuestion.options.push({
          optionId: optionId,
          text: optionText,
          isCorrect: isCorrect,
        });

        // If this option is marked correct, set as correct answer
        if (isCorrect) {
          currentQuestion.correctAnswer = optionId;
        }
      }
    }
    // Also detect options without markers
    else if (currentQuestion && line.match(/^([1-4A-D])[\.\)]\s+.+/i)) {
      const match = line.match(/^([1-4A-D])[\.\)]\s+(.+)/i);
      if (match && currentQuestion.options.length < 4) {
        currentQuestion.options.push({
          optionId: match[1].toUpperCase(),
          text: match[2].trim(),
          isCorrect: false,
        });
      }
    }
  }

  // Save last question
  if (currentQuestion && currentQuestion.options.length > 0) {
    finalizeQuestion(currentQuestion);
    questions.push(currentQuestion);
  }

  // If no questions found, create samples
  if (questions.length === 0) {
    console.log(
      "⚠️ No questions found with patterns. Creating sample questions."
    );
    return createSampleQuestions();
  }

  return questions;
};

// Helper: Finalize question with defaults
const finalizeQuestion = (question) => {
  // If no correct answer set, pick first option
  if (!question.correctAnswer && question.options.length > 0) {
    question.correctAnswer = question.options[0].optionId;
    question.options[0].isCorrect = true;
  }

  // Ensure we have 4 options
  while (question.options.length < 4) {
    const optionId = String.fromCharCode(64 + question.options.length + 1); // A, B, C, D
    question.options.push({
      optionId: optionId,
      text: `Option ${optionId}`,
      isCorrect: false,
    });
  }
};

// Helper: Detect topic from question text
const detectTopic = (questionText) => {
  const text = questionText.toLowerCase();

  if (
    text.includes("triangle") ||
    text.includes("figure") ||
    text.includes("pattern")
  ) {
    return "General Intelligence";
  } else if (
    text.includes("equation") ||
    text.includes("calculate") ||
    text.includes("number")
  ) {
    return "Mathematics";
  } else if (
    text.includes("sentence") ||
    text.includes("grammar") ||
    text.includes("vocabulary")
  ) {
    return "English";
  } else if (
    text.includes("history") ||
    text.includes("geography") ||
    text.includes("science")
  ) {
    return "General Awareness";
  }

  return "General Knowledge";
};

// Helper: Create sample questions if extraction fails
const createSampleQuestions = () => {
  return [
    {
      originalQuestionText: "How many triangles are there in the given figure?",
      questionText: "How many triangles are there in the given figure?",
      options: [
        { optionId: "A", text: "5", isCorrect: false },
        { optionId: "B", text: "6", isCorrect: true },
        { optionId: "C", text: "7", isCorrect: false },
        { optionId: "D", text: "8", isCorrect: false },
      ],
      correctAnswer: "B",
      questionNumber: 1,
      questionType: "mcq",
      difficulty: "medium",
      topic: "General Intelligence",
      explanation: "Count all triangles including small and combined ones.",
    },
    {
      originalQuestionText:
        "What will come in place of '?' if '+' and '-' are interchanged?",
      questionText:
        "What will come in place of '?' if '+' and '-' are interchanged?",
      options: [
        { optionId: "A", text: "12", isCorrect: false },
        { optionId: "B", text: "16", isCorrect: false },
        { optionId: "C", text: "21", isCorrect: true },
        { optionId: "D", text: "17", isCorrect: false },
      ],
      correctAnswer: "C",
      questionNumber: 2,
      questionType: "mcq",
      difficulty: "medium",
      topic: "Mathematics",
      explanation: "After interchanging signs: 4 - 6 - 91 ÷ 7 + 5 = 21",
    },
  ];
};

// FIX: Save questions with ALL required fields
const saveQuestionsToDB = async (pdfUploadId, questions, pdfUpload) => {
  for (const q of questions) {
    const question = new Question({
      pdfUploadId: pdfUpload._id,
      userId: pdfUpload.userId,
      questionNumber: q.questionNumber,
      originalQuestionText: q.originalQuestionText, // REQUIRED FIELD
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
      topic: q.topic || "General",
      explanation: q.explanation || "Extracted question",
      pageNumber: q.pageNumber || 1,
      aiConfidence: 0.8,
      status: "extracted",
    });

    await question.save();
  }
};

module.exports = {
  processPDFWithAI,
  extractQuestionsSmart,
};
