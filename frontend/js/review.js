// Review Page JavaScript - Updated for Real Backend

document.addEventListener("DOMContentLoaded", async function () {
  // Check authentication
  if (!PDFPracticePro.requireAuth()) return;

  // Get PDF ID from URL
  const urlParams = new URLSearchParams(window.location.search);
  const pdfId = urlParams.get("pdfId");

  if (!pdfId) {
    PDFPracticePro.showNotification(
      "No PDF specified. Please upload a PDF first.",
      "error"
    );
    setTimeout(() => {
      window.location.href = "upload.html";
    }, 2000);
    return;
  }

  // Initialize review page
  await initReviewPage(pdfId);

  // Load questions
  await loadQuestions(pdfId);
});

async function initReviewPage(pdfId) {
  // Navigation buttons
  const backBtn = document.getElementById("back-btn");
  const startTestBtn = document.getElementById("start-test-btn");

  if (backBtn) {
    backBtn.addEventListener("click", () => {
      window.location.href = "upload.html";
    });
  }

  if (startTestBtn) {
    startTestBtn.addEventListener("click", async () => {
      await startTestFromPDF(pdfId);
    });
  }

  // Load PDF info
  await loadPDFInfo(pdfId);

  // Initialize variables
  window.currentQuestionId = 1;
  window.questions = [];
  window.selectedQuestions = new Set();
  window.pdfId = pdfId;
}

async function loadPDFInfo(pdfId) {
  try {
    const response = await PDFPracticePro.makeRequest(
      `/upload/${pdfId}/status`
    );

    if (response && response.success) {
      const pdfUpload = response.pdfUpload;

      // Update header info
      const examBadge = document.querySelector(".exam-badge");
      if (examBadge) {
        examBadge.textContent = pdfUpload.examType.toUpperCase();
        examBadge.className = `exam-badge ${pdfUpload.examType}`;
      }

      const examTitle = document.querySelector(".exam-info h3");
      if (examTitle) {
        examTitle.textContent = pdfUpload.paperTitle || pdfUpload.originalName;
      }

      const examMeta = document.querySelector(".exam-info p");
      if (examMeta) {
        examMeta.textContent = `Uploaded: ${PDFPracticePro.formatDate(
          pdfUpload.createdAt
        )} • ${pdfUpload.totalQuestions || 0} questions detected`;
      }

      // Update stats
      document.getElementById("verified-count").textContent =
        pdfUpload.verifiedQuestions || 0;
      document.getElementById("needs-review-count").textContent =
        pdfUpload.totalQuestions - (pdfUpload.verifiedQuestions || 0);
      document.getElementById("edited-count").textContent = "0"; // Would need to calculate from questions
    } else {
      throw new Error("Failed to load PDF info");
    }
  } catch (error) {
    console.error("Error loading PDF info:", error);
    PDFPracticePro.showNotification("Failed to load PDF information", "error");
  }
}

async function loadQuestions(pdfId) {
  const questionsList = document.getElementById("questions-list");

  try {
    // Show loading state
    questionsList.innerHTML = '<div class="loading">Loading questions...</div>';

    // Fetch questions from backend
    const response = await PDFPracticePro.makeRequest(
      `/questions/pdf/${pdfId}`
    );

    if (response && response.success) {
      window.questions = response.questions;

      // Clear list
      questionsList.innerHTML = "";

      if (window.questions.length === 0) {
        questionsList.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-inbox" style="font-size: 2rem; color: var(--gray-light); margin-bottom: 10px;"></i>
                        <p>No questions extracted yet</p>
                        <p style="font-size: 0.9rem;">Try reprocessing the PDF</p>
                    </div>
                `;
        return;
      }

      // Add question items
      window.questions.forEach((question, index) => {
        const questionItem = document.createElement("div");
        questionItem.className = `question-item ${question.status}`;
        questionItem.dataset.id = question._id;
        questionItem.dataset.index = index;

        // Truncate question text for preview
        const previewText =
          question.questionText.length > 80
            ? question.questionText.substring(0, 80) + "..."
            : question.questionText;

        questionItem.innerHTML = `
                    <div class="question-check">
                        <input type="checkbox" class="question-checkbox" data-id="${
                          question._id
                        }">
                    </div>
                    <div class="question-number">${index + 1}</div>
                    <div class="question-preview">
                        <div class="question-text">${previewText}</div>
                        <div class="question-meta">
                            <span>${question.topic || "General"}</span>
                            <span>${question.difficulty}</span>
                            <span>${
                              question.options?.length || 0
                            } options</span>
                        </div>
                    </div>
                    <div class="status-indicator status-${
                      question.status
                    }"></div>
                `;

        // Add click event
        questionItem.addEventListener("click", (e) => {
          if (!e.target.classList.contains("question-checkbox")) {
            loadQuestion(index);
          }
        });

        // Add checkbox event
        const checkbox = questionItem.querySelector(".question-checkbox");
        checkbox.addEventListener("change", (e) => {
          e.stopPropagation();
          toggleQuestionSelection(question._id, checkbox.checked);
        });

        questionsList.appendChild(questionItem);
      });

      // Load first question
      if (window.questions.length > 0) {
        loadQuestion(0);
      }

      // Update stats
      updateStats();
    } else {
      throw new Error("Failed to load questions");
    }
  } catch (error) {
    console.error("Error loading questions:", error);
    questionsList.innerHTML =
      '<div class="error">Failed to load questions</div>';
  }
}

function loadQuestion(index) {
  if (index < 0 || index >= window.questions.length) return;

  const question = window.questions[index];
  window.currentQuestionId = question._id;
  window.currentQuestionIndex = index;

  // Update active state in list
  document.querySelectorAll(".question-item").forEach((item) => {
    item.classList.remove("active");
    if (parseInt(item.dataset.index) === index) {
      item.classList.add("active");
    }
  });

  // Update editor title
  document.getElementById("editor-title").textContent = `Edit Question #${
    index + 1
  }`;

  // Load question text
  document.getElementById("question-text").value = question.questionText;

  // Load options
  loadOptions(question.options, question.correctAnswer);

  // Load correct answer
  document.getElementById("correct-answer").value =
    question.correctAnswer || "";

  // Load metadata
  document.getElementById("question-type").value =
    question.questionType || "mcq";
  document.getElementById("difficulty").value = question.difficulty || "medium";
  document.getElementById("topic").value = question.topic || "";
  document.getElementById("explanation").value = question.explanation || "";

  // Update status badge
  updateStatusBadge(question.status);

  // Update navigation buttons
  updateNavigationButtons();
}

function loadOptions(options, correctAnswer) {
  const optionsList = document.getElementById("options-list");

  // Clear current options
  optionsList.innerHTML = "";

  if (!options || options.length === 0) {
    // Add default options
    const defaultOptions = [
      { optionId: "A", text: "" },
      { optionId: "B", text: "" },
      { optionId: "C", text: "" },
      { optionId: "D", text: "" },
    ];

    defaultOptions.forEach((opt) => {
      addOptionElement(opt.optionId, opt.text, opt.optionId === correctAnswer);
    });
    return;
  }

  // Add existing options
  options.forEach((option) => {
    addOptionElement(
      option.optionId,
      option.text,
      option.optionId === correctAnswer
    );
  });
}

function addOptionElement(optionId, text, isCorrect = false) {
  const optionsList = document.getElementById("options-list");

  const optionItem = document.createElement("div");
  optionItem.className = `option-item ${isCorrect ? "correct" : ""}`;
  optionItem.dataset.id = optionId;

  optionItem.innerHTML = `
        <div class="option-label">${optionId}</div>
        <div class="option-input">
            <input type="text" value="${
              text || ""
            }" placeholder="Enter option text...">
        </div>
        <div class="option-actions">
            <button class="option-action-btn correct-btn" title="Mark as correct">
                <i class="fas fa-check"></i>
            </button>
            <button class="option-action-btn delete" title="Delete option">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;

  // Add event listeners
  const input = optionItem.querySelector("input");
  const correctBtn = optionItem.querySelector(".correct-btn");
  const deleteBtn = optionItem.querySelector(".delete");

  input.addEventListener("input", () => {
    markQuestionAsEdited();
  });

  correctBtn.addEventListener("click", () => {
    setCorrectOption(optionId);
  });

  deleteBtn.addEventListener("click", () => {
    deleteOption(optionId);
  });

  optionsList.appendChild(optionItem);
}

// Add event listeners after DOM is loaded
document.addEventListener("DOMContentLoaded", function () {
  // Question navigation
  const prevBtn = document.getElementById("prev-question-btn");
  const nextBtn = document.getElementById("next-question-btn");

  if (prevBtn) {
    prevBtn.addEventListener("click", goToPreviousQuestion);
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", goToNextQuestion);
  }

  // Question actions
  const markVerifiedBtn = document.getElementById("mark-verified-btn");
  const saveQuestionBtn = document.getElementById("save-question-btn");
  const deleteQuestionBtn = document.getElementById("delete-question-btn");

  if (markVerifiedBtn) {
    markVerifiedBtn.addEventListener("click", markQuestionAsVerified);
  }

  if (saveQuestionBtn) {
    saveQuestionBtn.addEventListener("click", saveCurrentQuestion);
  }

  if (deleteQuestionBtn) {
    deleteQuestionBtn.addEventListener("click", deleteCurrentQuestion);
  }

  // Option management
  const addOptionBtn = document.getElementById("add-option-btn");
  if (addOptionBtn) {
    addOptionBtn.addEventListener("click", addNewOption);
  }

  // Text formatting tools
  const toolBtns = document.querySelectorAll(".tool-btn");
  toolBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const action = btn.dataset.action;
      formatText(action);
    });
  });

  // Bulk actions
  const selectAllBtn = document.getElementById("select-all-btn");
  const bulkVerifyBtn = document.getElementById("bulk-verify-btn");
  const bulkDeleteBtn = document.getElementById("bulk-delete-btn");
  const bulkSaveBtn = document.getElementById("bulk-save-btn");

  if (selectAllBtn) {
    selectAllBtn.addEventListener("click", toggleSelectAll);
  }

  if (bulkVerifyBtn) {
    bulkVerifyBtn.addEventListener("click", () => bulkAction("verify"));
  }

  if (bulkDeleteBtn) {
    bulkDeleteBtn.addEventListener("click", () => bulkAction("delete"));
  }

  if (bulkSaveBtn) {
    bulkSaveBtn.addEventListener("click", saveAllChanges);
  }

  // Modal setup
  const modal = document.getElementById("confirmation-modal");
  const modalClose = document.querySelector(".modal-close");
  const modalCancelBtn = document.getElementById("modal-cancel-btn");
  const modalConfirmBtn = document.getElementById("modal-confirm-btn");

  if (modalClose) modalClose.addEventListener("click", closeModal);
  if (modalCancelBtn) modalCancelBtn.addEventListener("click", closeModal);

  // Close modal on outside click
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });
  }
});

function addNewOption() {
  const optionsList = document.getElementById("options-list");
  const existingOptions = Array.from(optionsList.children);

  // Get next option letter
  let nextLetter = "A";
  if (existingOptions.length > 0) {
    const lastOption = existingOptions[existingOptions.length - 1];
    const lastLetter = lastOption.dataset.id;
    nextLetter = String.fromCharCode(lastLetter.charCodeAt(0) + 1);
  }

  // Don't allow more than 6 options
  if (existingOptions.length >= 6) {
    PDFPracticePro.showNotification("Maximum 6 options allowed", "warning");
    return;
  }

  addOptionElement(nextLetter, "", false);
  markQuestionAsEdited();
}

function deleteOption(optionId) {
  const optionsList = document.getElementById("options-list");
  const optionItem = optionsList.querySelector(`[data-id="${optionId}"]`);

  if (optionsList.children.length <= 2) {
    PDFPracticePro.showNotification(
      "Questions must have at least 2 options",
      "error"
    );
    return;
  }

  if (optionItem) {
    optionItem.remove();
    markQuestionAsEdited();

    // If deleted option was correct, clear correct answer selection
    if (optionItem.classList.contains("correct")) {
      document.getElementById("correct-answer").value = "";
    }
  }
}

function setCorrectOption(optionId) {
  // Remove correct class from all options
  document.querySelectorAll(".option-item").forEach((item) => {
    item.classList.remove("correct");
  });

  // Add correct class to selected option
  const selectedOption = document.querySelector(`[data-id="${optionId}"]`);
  if (selectedOption) {
    selectedOption.classList.add("correct");
    document.getElementById("correct-answer").value = optionId;
    markQuestionAsEdited();
  }
}

async function markQuestionAsVerified() {
  const question = window.questions[window.currentQuestionIndex];
  if (!question) return;

  try {
    const response = await PDFPracticePro.makeRequest(
      `/questions/${question._id}`,
      "PUT",
      {
        status: "verified",
      }
    );

    if (response && response.success) {
      question.status = "verified";
      updateQuestionInList(question);
      updateStatusBadge("verified");
      updateStats();
      PDFPracticePro.showNotification("Question marked as verified", "success");
    }
  } catch (error) {
    console.error("Error marking question as verified:", error);
    PDFPracticePro.showNotification("Failed to update question", "error");
  }
}

function markQuestionAsEdited() {
  const question = window.questions[window.currentQuestionIndex];
  if (question && question.status !== "edited") {
    question.status = "edited";
    updateQuestionInList(question);
    updateStatusBadge("edited");
    updateStats();
  }
}

async function saveCurrentQuestion() {
  const question = window.questions[window.currentQuestionIndex];
  if (!question) return;

  // Get question text
  const questionText = document.getElementById("question-text").value.trim();
  if (!questionText) {
    PDFPracticePro.showNotification("Question text cannot be empty", "error");
    return;
  }

  // Get options
  const optionItems = document.querySelectorAll(".option-item");
  const options = Array.from(optionItems).map((item) => {
    const id = item.dataset.id;
    const text = item.querySelector("input").value.trim();
    const isCorrect = item.classList.contains("correct");

    return {
      optionId: id,
      text: text,
      isCorrect: isCorrect,
    };
  });

  // Validate options
  const validOptions = options.filter((opt) => opt.text);
  if (validOptions.length < 2) {
    PDFPracticePro.showNotification(
      "At least 2 options must have text",
      "error"
    );
    return;
  }

  // Get correct answer
  const correctOption = options.find((opt) => opt.isCorrect);
  if (!correctOption) {
    PDFPracticePro.showNotification("Please select a correct answer", "error");
    return;
  }

  // Get metadata
  const questionType = document.getElementById("question-type").value;
  const difficulty = document.getElementById("difficulty").value;
  const topic = document.getElementById("topic").value.trim();
  const explanation = document.getElementById("explanation").value.trim();

  try {
    const response = await PDFPracticePro.makeRequest(
      `/questions/${question._id}`,
      "PUT",
      {
        questionText,
        options: validOptions,
        correctAnswer: correctOption.optionId,
        questionType,
        difficulty,
        topic,
        explanation,
        status: "edited",
      }
    );

    if (response && response.success) {
      // Update local question data
      Object.assign(question, response.question);

      // Update in list
      updateQuestionInList(question);

      // Update stats
      updateStats();

      PDFPracticePro.showNotification("Question saved successfully", "success");
    }
  } catch (error) {
    console.error("Error saving question:", error);
    PDFPracticePro.showNotification("Failed to save question", "error");
  }
}

async function deleteCurrentQuestion() {
  const question = window.questions[window.currentQuestionIndex];
  if (!question) return;

  showConfirmationModal(
    "Delete Question",
    "Are you sure you want to delete this question? This action cannot be undone.",
    async () => {
      try {
        const response = await PDFPracticePro.makeRequest(
          `/questions/bulk/delete`,
          "DELETE",
          {
            questionIds: [question._id],
          }
        );

        if (response && response.success) {
          // Remove from local array
          window.questions.splice(window.currentQuestionIndex, 1);

          // Reload questions list
          await loadQuestions(window.pdfId);

          // Load next question or previous if available
          if (window.questions.length > 0) {
            const nextIndex = Math.min(
              window.currentQuestionIndex,
              window.questions.length - 1
            );
            loadQuestion(nextIndex);
          } else {
            // No questions left
            document.getElementById("editor-content").innerHTML = `
                            <div class="no-questions" style="text-align: center; padding: 50px;">
                                <i class="fas fa-inbox" style="font-size: 3rem; color: var(--gray-light); margin-bottom: 20px;"></i>
                                <h3>No Questions Available</h3>
                                <p>All questions have been deleted.</p>
                                <a href="upload.html" class="btn btn-primary" style="margin-top: 20px;">
                                    Upload New PDF
                                </a>
                            </div>
                        `;
          }

          updateStats();
          PDFPracticePro.showNotification("Question deleted", "success");
        }
      } catch (error) {
        console.error("Error deleting question:", error);
        PDFPracticePro.showNotification("Failed to delete question", "error");
      }
    }
  );
}

function updateQuestionInList(question) {
  const questionItem = document.querySelector(
    `.question-item[data-id="${question._id}"]`
  );
  if (questionItem) {
    // Update classes
    questionItem.className = `question-item ${question.status} ${
      question._id === window.currentQuestionId ? "active" : ""
    }`;

    // Update preview text
    const previewText =
      question.questionText.length > 80
        ? question.questionText.substring(0, 80) + "..."
        : question.questionText;
    questionItem.querySelector(".question-text").textContent = previewText;

    // Update metadata
    const meta = questionItem.querySelector(".question-meta");
    if (meta) {
      meta.innerHTML = `
                <span>${question.topic || "General"}</span>
                <span>${question.difficulty}</span>
                <span>${question.options?.length || 0} options</span>
            `;
    }

    // Update status indicator
    const indicator = questionItem.querySelector(".status-indicator");
    if (indicator) {
      indicator.className = `status-indicator status-${question.status}`;
    }
  }
}

function updateStatusBadge(status) {
  const statusBadge = document.querySelector(".status-badge");
  if (statusBadge) {
    statusBadge.className = `status-badge ${status}`;
    statusBadge.textContent =
      status.charAt(0).toUpperCase() + status.slice(1).replace("-", " ");
  }
}

function updateNavigationButtons() {
  const prevBtn = document.getElementById("prev-question-btn");
  const nextBtn = document.getElementById("next-question-btn");

  if (prevBtn) {
    prevBtn.disabled = window.currentQuestionIndex <= 0;
  }

  if (nextBtn) {
    nextBtn.disabled =
      window.currentQuestionIndex >= window.questions.length - 1;
  }
}

function goToPreviousQuestion() {
  if (window.currentQuestionIndex > 0) {
    loadQuestion(window.currentQuestionIndex - 1);
  }
}

function goToNextQuestion() {
  if (window.currentQuestionIndex < window.questions.length - 1) {
    loadQuestion(window.currentQuestionIndex + 1);
  }
}

function toggleSelectAll() {
  const checkboxes = document.querySelectorAll(".question-checkbox");
  const allChecked = Array.from(checkboxes).every((cb) => cb.checked);

  checkboxes.forEach((cb) => {
    cb.checked = !allChecked;
    const questionId = cb.dataset.id;
    toggleQuestionSelection(questionId, !allChecked);
  });
}

function toggleQuestionSelection(questionId, selected) {
  if (selected) {
    window.selectedQuestions.add(questionId);
  } else {
    window.selectedQuestions.delete(questionId);
  }

  updateBulkActionsBar();
}

function updateBulkActionsBar() {
  const bulkBar = document.getElementById("bulk-actions-bar");
  const selectedCount = document.getElementById("selected-count");

  if (window.selectedQuestions.size > 0) {
    bulkBar.classList.add("show");
    selectedCount.textContent = window.selectedQuestions.size;
  } else {
    bulkBar.classList.remove("show");
  }
}

async function bulkAction(action) {
  if (window.selectedQuestions.size === 0) return;

  const questionIds = Array.from(window.selectedQuestions);

  switch (action) {
    case "verify":
      showConfirmationModal(
        "Verify Multiple Questions",
        `Are you sure you want to mark ${window.selectedQuestions.size} questions as verified?`,
        async () => {
          try {
            const response = await PDFPracticePro.makeRequest(
              `/questions/bulk/update`,
              "PUT",
              {
                questionIds,
                updates: { status: "verified" },
              }
            );

            if (response && response.success) {
              // Update local questions
              window.questions.forEach((q) => {
                if (window.selectedQuestions.has(q._id)) {
                  q.status = "verified";
                  updateQuestionInList(q);
                }
              });

              window.selectedQuestions.clear();
              updateBulkActionsBar();
              updateStats();
              PDFPracticePro.showNotification(
                `${questionIds.length} questions marked as verified`,
                "success"
              );
            }
          } catch (error) {
            console.error("Error bulk verifying questions:", error);
            PDFPracticePro.showNotification(
              "Failed to verify questions",
              "error"
            );
          }
        }
      );
      break;

    case "delete":
      showConfirmationModal(
        "Delete Multiple Questions",
        `Are you sure you want to delete ${window.selectedQuestions.size} questions? This action cannot be undone.`,
        async () => {
          try {
            const response = await PDFPracticePro.makeRequest(
              `/questions/bulk/delete`,
              "DELETE",
              {
                questionIds,
              }
            );

            if (response && response.success) {
              // Filter out selected questions
              window.questions = window.questions.filter(
                (q) => !window.selectedQuestions.has(q._id)
              );

              // Reload questions
              await loadQuestions(window.pdfId);

              // Load first question if available
              if (window.questions.length > 0) {
                loadQuestion(0);
              }

              window.selectedQuestions.clear();
              updateBulkActionsBar();
              updateStats();
              PDFPracticePro.showNotification(
                "Questions deleted successfully",
                "success"
              );
            }
          } catch (error) {
            console.error("Error bulk deleting questions:", error);
            PDFPracticePro.showNotification(
              "Failed to delete questions",
              "error"
            );
          }
        }
      );
      break;
  }
}

async function saveAllChanges() {
  try {
    // Save current question first
    await saveCurrentQuestion();

    // Show success message
    PDFPracticePro.showNotification(
      "All changes saved successfully",
      "success"
    );
  } catch (error) {
    console.error("Error saving all changes:", error);
    PDFPracticePro.showNotification("Failed to save changes", "error");
  }
}

function formatText(action) {
  const textarea = document.getElementById("question-text");
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selectedText = textarea.value.substring(start, end);

  let formattedText = "";
  switch (action) {
    case "bold":
      formattedText = `<strong>${selectedText}</strong>`;
      break;
    case "italic":
      formattedText = `<em>${selectedText}</em>`;
      break;
    case "superscript":
      formattedText = `<sup>${selectedText}</sup>`;
      break;
  }

  const newText =
    textarea.value.substring(0, start) +
    formattedText +
    textarea.value.substring(end);
  textarea.value = newText;

  // Mark as edited
  markQuestionAsEdited();
}

function updateStats() {
  if (!window.questions) return;

  const verifiedCount = window.questions.filter(
    (q) => q.status === "verified"
  ).length;
  const reviewCount = window.questions.filter(
    (q) => q.status === "extracted" || q.status === "needs_review"
  ).length;
  const editedCount = window.questions.filter(
    (q) => q.status === "edited"
  ).length;

  document.getElementById("verified-count").textContent = verifiedCount;
  document.getElementById("needs-review-count").textContent = reviewCount;
  document.getElementById("edited-count").textContent = editedCount;
}

function showConfirmationModal(title, message, confirmCallback) {
  const modal = document.getElementById("confirmation-modal");
  const modalMessage = document.getElementById("modal-message");
  const modalConfirmBtn = document.getElementById("modal-confirm-btn");

  if (!modal || !modalMessage || !modalConfirmBtn) return;

  modalMessage.textContent = message;
  modal.classList.add("show");

  // Remove previous event listeners
  const newConfirmBtn = modalConfirmBtn.cloneNode(true);
  modalConfirmBtn.parentNode.replaceChild(newConfirmBtn, modalConfirmBtn);

  // Add new event listener
  newConfirmBtn.addEventListener("click", () => {
    confirmCallback();
    closeModal();
  });
}

function closeModal() {
  const modal = document.getElementById("confirmation-modal");
  if (modal) {
    modal.classList.remove("show");
  }
}

async function startTestFromPDF(pdfId) {
  try {
    // First save any unsaved changes
    await saveAllChanges();

    // Start a new test session
    const response = await PDFPracticePro.makeRequest("/test/start", "POST", {
      pdfId: pdfId,
      timeLimit: 3600, // 1 hour default
    });

    if (response && response.success) {
      // Redirect to test page
      window.location.href = `test.html?session=${response.session.sessionId}`;
    }
  } catch (error) {
    console.error("Error starting test:", error);
    PDFPracticePro.showNotification("Failed to start test", "error");
  }
}

// Add CSS for review page
if (!document.querySelector("#review-styles")) {
  const style = document.createElement("style");
  style.id = "review-styles";
  style.textContent = `
        .loading {
            text-align: center;
            padding: 40px;
            color: var(--gray);
            font-style: italic;
        }
        
        .empty-state {
            text-align: center;
            padding: 40px 20px;
            color: var(--gray);
        }
        
        .empty-state i {
            margin-bottom: 15px;
        }
        
        .error {
            text-align: center;
            padding: 20px;
            color: var(--danger);
            font-style: italic;
        }
        
        .no-questions {
            text-align: center;
            padding: 50px 20px;
        }
        
        .exam-badge.upsc {
            background: #DC2626;
        }
        
        .exam-badge.ssc {
            background: #2563EB;
        }
        
        .exam-badge.jee {
            background: #059669;
        }
        
        .exam-badge.banking {
            background: #7C3AED;
        }
        
        .exam-badge.general {
            background: var(--gray);
        }
    `;
  document.head.appendChild(style);
}
