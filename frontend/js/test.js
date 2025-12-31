// Test Interface JavaScript - Updated for Real Backend

document.addEventListener("DOMContentLoaded", async function () {
  // Check authentication
  if (!PDFPracticePro.requireAuth()) return;

  // Get test session from URL
  const urlParams = new URLSearchParams(window.location.search);
  const sessionId = urlParams.get("session");

  if (!sessionId) {
    PDFPracticePro.showNotification("No test session specified", "error");
    setTimeout(() => {
      window.location.href = "dashboard.html";
    }, 2000);
    return;
  }

  // Initialize test
  await initTest(sessionId);

  // Load test questions
  await loadTestQuestions(sessionId);

  // Start timer
  startTimer();

  // Auto-save progress periodically
  startAutoSave(sessionId);

  // Warn before leaving page
  setupPageLeaveWarning();
});

async function initTest(sessionId) {
  // Initialize variables
  window.testSession = null;
  window.questions = [];
  window.currentQuestionIndex = 0;
  window.userAnswers = {};
  window.markedQuestions = new Set();
  window.testStarted = false;
  window.timeRemaining = 0;
  window.timerInterval = null;
  window.autoSaveInterval = null;

  // Sidebar toggle
  const sidebarToggle = document.getElementById("sidebar-toggle");
  const testSidebar = document.getElementById("test-sidebar");

  if (sidebarToggle && testSidebar) {
    sidebarToggle.addEventListener("click", () => {
      testSidebar.classList.toggle("collapsed");
    });
  }

  // Load test session data
  await loadTestSession(sessionId);

  // Initialize question navigation grid
  initQuestionGrid();

  // Setup event listeners
  setupEventListeners(sessionId);
}

async function loadTestSession(sessionId) {
  try {
    const response = await PDFPracticePro.makeRequest(
      `/test/session/${sessionId}`
    );

    if (response && response.success) {
      window.testSession = response.session;
      window.questions = response.questions;

      // Initialize user answers from session
      if (window.testSession.answers) {
        window.testSession.answers.forEach((answer) => {
          window.userAnswers[answer.questionNumber] = {
            selectedOption: answer.selectedOption,
            timeSpent: answer.timeSpent || 0,
            markedForReview: answer.markedForReview || false,
          };

          if (answer.markedForReview) {
            window.markedQuestions.add(answer.questionNumber);
          }
        });
      }

      // Initialize marked questions
      if (window.testSession.markedQuestions) {
        window.testSession.markedQuestions.forEach((qNum) => {
          window.markedQuestions.add(qNum);
        });
      }

      // Set current question
      window.currentQuestionIndex = Math.max(
        0,
        (window.testSession.currentQuestion || 1) - 1
      );

      // Set time remaining
      window.timeRemaining =
        window.testSession.timeRemaining || window.testSession.timeLimit;

      // Update UI with test info
      updateTestInfo();

      // Update progress
      updateProgress();
    } else {
      throw new Error("Failed to load test session");
    }
  } catch (error) {
    console.error("Error loading test session:", error);
    PDFPracticePro.showNotification("Failed to load test session", "error");
    setTimeout(() => {
      window.location.href = "dashboard.html";
    }, 2000);
  }
}

function updateTestInfo() {
  if (!window.testSession) return;

  // Update test title
  document.getElementById("test-title").textContent = window.testSession.title;

  // Update test subtitle
  const totalTime = window.testSession.timeLimit;
  const hours = Math.floor(totalTime / 3600);
  const minutes = Math.floor((totalTime % 3600) / 60);
  const subtitle = `${window.testSession.totalQuestions} Questions • ${
    hours > 0 ? `${hours}h ` : ""
  }${minutes}m`;
  document.getElementById("test-subtitle").textContent = subtitle;

  // Update timer display
  updateTimerDisplay();
}

function setupEventListeners(sessionId) {
  // Question navigation
  const prevBtn = document.getElementById("prev-btn");
  const nextBtn = document.getElementById("next-btn");

  if (prevBtn) prevBtn.addEventListener("click", goToPreviousQuestion);
  if (nextBtn) nextBtn.addEventListener("click", goToNextQuestion);

  // Question actions
  const markBtn = document.getElementById("mark-btn");
  const clearBtn = document.getElementById("clear-btn");

  if (markBtn)
    markBtn.addEventListener("click", () => toggleMarkQuestion(sessionId));
  if (clearBtn)
    clearBtn.addEventListener("click", () => clearCurrentAnswer(sessionId));

  // Timer controls
  const pauseBtn = document.getElementById("pause-btn");
  const fullscreenBtn = document.getElementById("fullscreen-btn");
  const resumeBtn = document.getElementById("resume-btn");
  const returnFullscreenBtn = document.getElementById("return-fullscreen-btn");

  if (pauseBtn) pauseBtn.addEventListener("click", togglePause);
  if (fullscreenBtn) fullscreenBtn.addEventListener("click", toggleFullscreen);
  if (resumeBtn) resumeBtn.addEventListener("click", resumeTest);
  if (returnFullscreenBtn)
    returnFullscreenBtn.addEventListener("click", enterFullscreen);

  // Test submission
  const submitTestBtn = document.getElementById("submit-test-btn");
  const saveExitBtn = document.getElementById("save-exit-btn");
  const endTestBtn = document.getElementById("end-test-btn");

  if (submitTestBtn)
    submitTestBtn.addEventListener("click", () => showSubmitModal(sessionId));
  if (saveExitBtn)
    saveExitBtn.addEventListener("click", () => saveAndExit(sessionId));
  if (endTestBtn)
    endTestBtn.addEventListener("click", () => endTest(sessionId));

  // Modal controls
  const modalCancelBtn = document.getElementById("modal-cancel-btn");
  const modalSubmitBtn = document.getElementById("modal-submit-btn");
  const modalClose = document.querySelector(".modal-close");

  if (modalCancelBtn)
    modalCancelBtn.addEventListener("click", closeSubmitModal);
  if (modalSubmitBtn)
    modalSubmitBtn.addEventListener("click", () => submitTest(sessionId));
  if (modalClose) modalClose.addEventListener("click", closeSubmitModal);

  // Close modal on outside click
  const submitModal = document.getElementById("submit-modal");
  if (submitModal) {
    submitModal.addEventListener("click", (e) => {
      if (e.target === submitModal) {
        closeSubmitModal();
      }
    });
  }

  // Fullscreen detection
  document.addEventListener("fullscreenchange", handleFullscreenChange);
  document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
  document.addEventListener("mozfullscreenchange", handleFullscreenChange);
  document.addEventListener("MSFullscreenChange", handleFullscreenChange);

  // Visibility change (tab switch)
  document.addEventListener("visibilitychange", handleVisibilityChange);

  // Prevent accidental refresh/close
  window.addEventListener("beforeunload", handleBeforeUnload);

  // Keyboard shortcuts
  setupKeyboardShortcuts(sessionId);
}

function setupKeyboardShortcuts(sessionId) {
  document.addEventListener("keydown", (e) => {
    // Don't trigger shortcuts when user is typing
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

    switch (e.key) {
      case "ArrowLeft":
        e.preventDefault();
        goToPreviousQuestion();
        break;

      case "ArrowRight":
        e.preventDefault();
        goToNextQuestion();
        break;

      case " ":
      case "Spacebar":
        e.preventDefault();
        document.getElementById("mark-btn")?.click();
        break;

      case "1":
      case "2":
      case "3":
      case "4":
        e.preventDefault();
        selectOption(parseInt(e.key) - 1);
        break;

      case "A":
      case "a":
        e.preventDefault();
        selectOption(0);
        break;

      case "B":
      case "b":
        e.preventDefault();
        selectOption(1);
        break;

      case "C":
      case "c":
        e.preventDefault();
        selectOption(2);
        break;

      case "D":
      case "d":
        e.preventDefault();
        selectOption(3);
        break;

      case "Escape":
        if (document.fullscreenElement) {
          exitFullscreen();
        }
        break;
    }
  });
}

function selectOption(optionIndex) {
  const options = document.querySelectorAll(".option-item");
  if (optionIndex < options.length) {
    const radio = options[optionIndex].querySelector('input[type="radio"]');
    if (radio) {
      radio.checked = true;
      radio.dispatchEvent(new Event("change"));
    }
  }
}

async function loadTestQuestions(sessionId) {
  if (!window.questions || window.questions.length === 0) {
    PDFPracticePro.showNotification("No questions available", "error");
    return;
  }

  // Load current question
  loadQuestion(window.currentQuestionIndex);
}

function loadQuestion(questionIndex) {
  if (questionIndex < 0 || questionIndex >= window.questions.length) return;

  window.currentQuestionIndex = questionIndex;
  const question = window.questions[questionIndex];

  // Update question number display
  document.getElementById("question-number").textContent = `Question ${
    questionIndex + 1
  }`;
  document.getElementById("nav-info").textContent = `Question ${
    questionIndex + 1
  } of ${window.questions.length}`;

  // Update question text
  const questionText = document.getElementById("question-text");
  questionText.innerHTML = `<p>${question.questionText}</p>`;

  // Update question metadata
  document.getElementById("question-marks").textContent = `• ${
    question.marks || 1
  } marks`;
  document.getElementById("question-topic").textContent =
    question.topic || "General";

  // Load options
  loadOptions(question.options, questionIndex + 1);

  // Update mark button
  updateMarkButton(questionIndex + 1);

  // Update active state in sidebar
  updateQuestionGrid();

  // Update navigation buttons
  updateNavigationButtons();

  // Start question timer
  startQuestionTimer(questionIndex + 1);
}

function loadOptions(options, questionNumber) {
  const container = document.getElementById("options-container");

  // Clear existing options
  container.innerHTML = "";

  // Get current answer
  const currentAnswer = window.userAnswers[questionNumber];

  // Add options
  options.forEach((option, index) => {
    const optionItem = document.createElement("div");
    optionItem.className = "option-item";

    const isSelected =
      currentAnswer && currentAnswer.selectedOption === option.optionId;
    const optionId = `q${questionNumber}_${option.optionId}`;

    optionItem.innerHTML = `
            <label class="option-label ${isSelected ? "selected" : ""}">
                <div class="option-radio">
                    <input type="radio" 
                           id="${optionId}"
                           name="q${questionNumber}" 
                           value="${option.optionId}" 
                           ${isSelected ? "checked" : ""}
                           data-question="${questionNumber}"
                           data-option="${option.optionId}">
                </div>
                <div class="option-content">
                    <div class="option-text">${option.text}</div>
                </div>
            </label>
        `;

    // Add event listener
    const radioInput = optionItem.querySelector("input");
    const label = optionItem.querySelector(".option-label");

    radioInput.addEventListener("change", async (e) => {
      if (e.target.checked) {
        // Remove selected class from all options
        container.querySelectorAll(".option-label").forEach((l) => {
          l.classList.remove("selected");
        });

        // Add selected class to current option
        label.classList.add("selected");

        // Save answer
        await saveAnswer(questionNumber, option.optionId);
      }
    });

    container.appendChild(optionItem);
  });
}

async function saveAnswer(questionNumber, answer) {
  // Get time spent on this question
  const questionTimer = window.questionTimers?.[questionNumber] || 0;

  // Update local state
  window.userAnswers[questionNumber] = {
    selectedOption: answer,
    timeSpent: questionTimer,
    answeredAt: new Date().toISOString(),
  };

  // Update progress
  updateProgress();

  // Save to backend
  await saveAnswerToBackend(questionNumber, answer, questionTimer);
}

async function saveAnswerToBackend(questionNumber, selectedOption, timeSpent) {
  try {
    const sessionId = window.testSession?.sessionId;
    if (!sessionId) return;

    await PDFPracticePro.makeRequest(
      `/test/session/${sessionId}/answer`,
      "POST",
      {
        questionNumber: parseInt(questionNumber),
        selectedOption,
        timeSpent: Math.round(timeSpent),
        markedForReview: window.markedQuestions.has(questionNumber),
      }
    );
  } catch (error) {
    console.error("Error saving answer:", error);
    // Don't show error to user for background saves
  }
}

async function clearCurrentAnswer(sessionId) {
  const questionNumber = window.currentQuestionIndex + 1;

  // Clear local answer
  delete window.userAnswers[questionNumber];

  // Clear from marked questions
  window.markedQuestions.delete(questionNumber);

  // Clear radio selection
  const container = document.getElementById("options-container");
  container.querySelectorAll('input[type="radio"]').forEach((radio) => {
    radio.checked = false;
  });

  // Remove selected class
  container.querySelectorAll(".option-label").forEach((label) => {
    label.classList.remove("selected");
  });

  // Update mark button
  updateMarkButton(questionNumber);

  // Update progress
  updateProgress();

  // Update question grid
  updateQuestionGrid();

  // Save to backend
  try {
    await PDFPracticePro.makeRequest(
      `/test/session/${sessionId}/progress`,
      "PUT",
      {
        answers: Object.entries(window.userAnswers).map(([qNum, answer]) => ({
          questionNumber: parseInt(qNum),
          selectedOption: answer.selectedOption,
          timeSpent: answer.timeSpent,
          markedForReview: window.markedQuestions.has(parseInt(qNum)),
        })),
        markedQuestions: Array.from(window.markedQuestions),
        currentQuestion: window.currentQuestionIndex + 1,
      }
    );
  } catch (error) {
    console.error("Error clearing answer:", error);
  }
}

async function toggleMarkQuestion(sessionId) {
  const questionNumber = window.currentQuestionIndex + 1;

  if (window.markedQuestions.has(questionNumber)) {
    window.markedQuestions.delete(questionNumber);
  } else {
    window.markedQuestions.add(questionNumber);
  }

  updateMarkButton(questionNumber);
  updateProgress();
  updateQuestionGrid();

  // Save to backend
  try {
    await PDFPracticePro.makeRequest(
      `/test/session/${sessionId}/progress`,
      "PUT",
      {
        markedQuestions: Array.from(window.markedQuestions),
        currentQuestion: window.currentQuestionIndex + 1,
      }
    );
  } catch (error) {
    console.error("Error marking question:", error);
  }
}

function updateMarkButton(questionNumber) {
  const markBtn = document.getElementById("mark-btn");
  if (!markBtn) return;

  if (window.markedQuestions.has(questionNumber)) {
    markBtn.innerHTML = '<i class="fas fa-bookmark"></i> Unmark';
    markBtn.classList.add("marked");
  } else {
    markBtn.innerHTML = '<i class="far fa-bookmark"></i> Mark for Review';
    markBtn.classList.remove("marked");
  }
}

function goToPreviousQuestion() {
  if (window.currentQuestionIndex > 0) {
    loadQuestion(window.currentQuestionIndex - 1);

    // Save progress
    saveProgress();
  }
}

function goToNextQuestion() {
  if (window.currentQuestionIndex < window.questions.length - 1) {
    loadQuestion(window.currentQuestionIndex + 1);

    // Save progress
    saveProgress();
  }
}

async function saveProgress() {
  const sessionId = window.testSession?.sessionId;
  if (!sessionId) return;

  try {
    await PDFPracticePro.makeRequest(
      `/test/session/${sessionId}/progress`,
      "PUT",
      {
        currentQuestion: window.currentQuestionIndex + 1,
        timeRemaining: window.timeRemaining,
        isPaused: window.isPaused || false,
      }
    );
  } catch (error) {
    console.error("Error saving progress:", error);
  }
}

function updateNavigationButtons() {
  const prevBtn = document.getElementById("prev-btn");
  const nextBtn = document.getElementById("next-btn");

  if (prevBtn) {
    prevBtn.disabled = window.currentQuestionIndex <= 0;
  }

  if (nextBtn) {
    nextBtn.disabled =
      window.currentQuestionIndex >= window.questions.length - 1;
  }
}

function initQuestionGrid() {
  const grid = document.getElementById("questions-grid");
  if (!grid) return;

  // Clear grid
  grid.innerHTML = "";

  // Add question buttons
  for (let i = 0; i < window.questions.length; i++) {
    const button = document.createElement("button");
    button.className = "question-btn";
    button.textContent = i + 1;
    button.dataset.question = i + 1;

    button.addEventListener("click", () => {
      loadQuestion(i);

      // Close sidebar on mobile
      if (window.innerWidth <= 992) {
        document.getElementById("test-sidebar").classList.remove("active");
      }

      // Save progress
      saveProgress();
    });

    grid.appendChild(button);
  }
}

function updateQuestionGrid() {
  const buttons = document.querySelectorAll(".question-btn");

  buttons.forEach((button, index) => {
    const questionNumber = index + 1;

    // Reset classes
    button.classList.remove("answered", "marked", "current");

    // Add answered class
    if (window.userAnswers[questionNumber]) {
      button.classList.add("answered");
    }

    // Add marked class
    if (window.markedQuestions.has(questionNumber)) {
      button.classList.add("marked");
    }

    // Add current class
    if (questionNumber === window.currentQuestionIndex + 1) {
      button.classList.add("current");
    }
  });
}

function updateProgress() {
  if (!window.testSession) return;

  // Calculate progress
  const answeredCount = Object.keys(window.userAnswers).length;
  const markedCount = window.markedQuestions.size;
  const remainingCount = window.questions.length - answeredCount;
  const progressPercentage = (answeredCount / window.questions.length) * 100;

  // Update progress bar
  const progressFill = document.getElementById("progress-fill");
  if (progressFill) {
    progressFill.style.width = `${progressPercentage}%`;
  }

  // Update stats
  const currentQuestionEl = document.getElementById("current-question");
  const answeredCountEl = document.getElementById("answered-count");
  const markedCountEl = document.getElementById("marked-count");
  const remainingCountEl = document.getElementById("remaining-count");

  if (currentQuestionEl)
    currentQuestionEl.textContent = window.currentQuestionIndex + 1;
  if (answeredCountEl) answeredCountEl.textContent = answeredCount;
  if (markedCountEl) markedCountEl.textContent = markedCount;
  if (remainingCountEl) remainingCountEl.textContent = remainingCount;

  // Update modal stats
  updateModalStats(answeredCount, markedCount, remainingCount);
}

function updateModalStats(answered, marked, remaining) {
  document.getElementById("modal-answered").textContent = answered;
  document.getElementById("modal-marked").textContent = marked;
  document.getElementById("modal-skipped").textContent = remaining;
}

function startTimer() {
  // Update timer immediately
  updateTimerDisplay();

  // Start timer interval
  window.timerInterval = setInterval(() => {
    if (!window.isPaused && window.timeRemaining > 0) {
      window.timeRemaining--;
      updateTimerDisplay();

      // Save time remaining every minute
      if (window.timeRemaining % 60 === 0) {
        saveProgress();
      }

      // Check if time is up
      if (window.timeRemaining <= 0) {
        clearInterval(window.timerInterval);
        timeUp();
      }
    }
  }, 1000);
}

function updateTimerDisplay() {
  const hours = Math.floor(window.timeRemaining / 3600);
  const minutes = Math.floor((window.timeRemaining % 3600) / 60);
  const seconds = window.timeRemaining % 60;

  const timeDisplay = document.getElementById("time-display");
  const pauseTimeDisplay = document.getElementById("pause-time");
  const timer = document.getElementById("timer");

  // Format time
  const formattedTime = `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

  if (timeDisplay) {
    timeDisplay.textContent = formattedTime;
  }

  if (pauseTimeDisplay) {
    pauseTimeDisplay.textContent = formattedTime;
  }

  // Add warning classes
  if (timer) {
    timer.classList.remove("warning", "danger");

    if (window.timeRemaining <= 300) {
      // 5 minutes
      timer.classList.add("danger");
    } else if (window.timeRemaining <= 900) {
      // 15 minutes
      timer.classList.add("warning");
    }
  }
}

function startQuestionTimer(questionNumber) {
  // Initialize question timers object if not exists
  if (!window.questionTimers) {
    window.questionTimers = {};
  }

  // Start timer for current question
  if (!window.questionTimers[questionNumber]) {
    window.questionTimers[questionNumber] = 0;
  }

  // Clear any existing interval for this question
  if (window.questionTimerInterval) {
    clearInterval(window.questionTimerInterval);
  }

  // Start new interval
  window.questionTimerInterval = setInterval(() => {
    if (!window.isPaused) {
      window.questionTimers[questionNumber]++;
    }
  }, 1000);
}

function togglePause() {
  window.isPaused = !window.isPaused;

  const pauseBtn = document.getElementById("pause-btn");
  const pauseOverlay = document.getElementById("pause-overlay");

  if (window.isPaused) {
    if (pauseBtn) {
      pauseBtn.innerHTML = '<i class="fas fa-play"></i>';
      pauseBtn.title = "Resume";
    }
    if (pauseOverlay) {
      pauseOverlay.classList.add("show");
    }

    // Save paused state
    saveProgress();
  } else {
    if (pauseBtn) {
      pauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
      pauseBtn.title = "Pause";
    }
    if (pauseOverlay) {
      pauseOverlay.classList.remove("show");
    }
  }
}

function resumeTest() {
  window.isPaused = false;

  const pauseBtn = document.getElementById("pause-btn");
  const pauseOverlay = document.getElementById("pause-overlay");

  if (pauseBtn) {
    pauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
    pauseBtn.title = "Pause";
  }
  if (pauseOverlay) {
    pauseOverlay.classList.remove("show");
  }
}

function toggleFullscreen() {
  if (!window.isFullscreen) {
    enterFullscreen();
  } else {
    exitFullscreen();
  }
}

function enterFullscreen() {
  const elem = document.documentElement;

  if (elem.requestFullscreen) {
    elem.requestFullscreen();
  } else if (elem.webkitRequestFullscreen) {
    /* Safari */
    elem.webkitRequestFullscreen();
  } else if (elem.msRequestFullscreen) {
    /* IE11 */
    elem.msRequestFullscreen();
  }
}

function exitFullscreen() {
  if (document.exitFullscreen) {
    document.exitFullscreen();
  } else if (document.webkitExitFullscreen) {
    /* Safari */
    document.webkitExitFullscreen();
  } else if (document.msExitFullscreen) {
    /* IE11 */
    document.msExitFullscreen();
  }
}

function handleFullscreenChange() {
  window.isFullscreen = !!document.fullscreenElement;

  const fullscreenBtn = document.getElementById("fullscreen-btn");
  const fullscreenWarning = document.getElementById("fullscreen-warning");

  if (fullscreenBtn) {
    fullscreenBtn.innerHTML = window.isFullscreen
      ? '<i class="fas fa-compress"></i>'
      : '<i class="fas fa-expand"></i>';
    fullscreenBtn.title = window.isFullscreen
      ? "Exit Fullscreen"
      : "Fullscreen";
  }

  if (!window.isFullscreen && window.timeRemaining > 0) {
    if (fullscreenWarning) {
      fullscreenWarning.classList.add("show");
    }
  } else {
    if (fullscreenWarning) {
      fullscreenWarning.classList.remove("show");
    }
  }
}

function handleVisibilityChange() {
  if (document.hidden && !window.isPaused && window.timeRemaining > 0) {
    // Tab switched - pause test
    window.isPaused = true;

    const pauseBtn = document.getElementById("pause-btn");
    const pauseOverlay = document.getElementById("pause-overlay");

    if (pauseBtn) {
      pauseBtn.innerHTML = '<i class="fas fa-play"></i>';
      pauseBtn.title = "Resume";
    }

    if (pauseOverlay) {
      pauseOverlay.classList.add("show");
    }

    PDFPracticePro.showNotification("Test paused due to tab switch", "warning");
  }
}

function startAutoSave(sessionId) {
  // Auto-save every 30 seconds
  window.autoSaveInterval = setInterval(async () => {
    if (!window.isPaused && window.timeRemaining > 0) {
      await saveProgress();
    }
  }, 30000);
}

function setupPageLeaveWarning() {
  window.addEventListener("beforeunload", (e) => {
    if (window.timeRemaining > 0 && !window.testSession?.submittedAt) {
      e.preventDefault();
      e.returnValue =
        "Your test progress will be lost if you leave this page. Are you sure?";
      return e.returnValue;
    }
  });
}

function showSubmitModal(sessionId) {
  const modal = document.getElementById("submit-modal");
  if (modal) {
    modal.classList.add("show");
  }
}

function closeSubmitModal() {
  const modal = document.getElementById("submit-modal");
  if (modal) {
    modal.classList.remove("show");
  }
}

async function submitTest(sessionId) {
  try {
    // Show loading state
    const submitBtn = document.getElementById("modal-submit-btn");
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML =
      '<i class="fas fa-spinner fa-spin"></i> Submitting...';
    submitBtn.disabled = true;

    // Submit test
    const response = await PDFPracticePro.makeRequest(
      `/test/session/${sessionId}/submit`,
      "POST"
    );

    if (response && response.success) {
      // Clear intervals
      clearInterval(window.timerInterval);
      clearInterval(window.autoSaveInterval);

      // Show success message
      PDFPracticePro.showNotification(
        "Test submitted successfully!",
        "success"
      );

      // Redirect to results page
      setTimeout(() => {
        window.location.href = `results.html?session=${sessionId}`;
      }, 1500);
    } else {
      throw new Error("Failed to submit test");
    }
  } catch (error) {
    console.error("Error submitting test:", error);
    PDFPracticePro.showNotification(
      "Failed to submit test. Please try again.",
      "error"
    );

    // Reset button
    const submitBtn = document.getElementById("modal-submit-btn");
    if (submitBtn) {
      submitBtn.innerHTML = "Submit Anyway";
      submitBtn.disabled = false;
    }
  }
}

async function saveAndExit(sessionId) {
  try {
    // Save progress
    await saveProgress();

    // Show confirmation
    PDFPracticePro.showNotification(
      "Test progress saved. You can resume later from your dashboard.",
      "success"
    );

    // Clear intervals
    clearInterval(window.timerInterval);
    clearInterval(window.autoSaveInterval);

    // Redirect to dashboard
    setTimeout(() => {
      window.location.href = "dashboard.html";
    }, 1500);
  } catch (error) {
    console.error("Error saving and exiting:", error);
    PDFPracticePro.showNotification("Failed to save progress", "error");
  }
}

function endTest(sessionId) {
  showConfirmation(
    "End Test",
    "Are you sure you want to end the test? All progress will be lost.",
    async () => {
      // Clear intervals
      clearInterval(window.timerInterval);
      clearInterval(window.autoSaveInterval);

      // Redirect to dashboard
      window.location.href = "dashboard.html";
    }
  );
}

function timeUp() {
  showConfirmation(
    "Time's Up!",
    "The test time has ended. Your answers will be automatically submitted.",
    async () => {
      const sessionId = window.testSession?.sessionId;
      if (sessionId) {
        await submitTest(sessionId);
      }
    }
  );
}

function showConfirmation(title, message, confirmCallback) {
  // Create confirmation modal
  const modal = document.createElement("div");
  modal.className = "modal";
  modal.innerHTML = `
        <div class="modal-content modal-sm">
            <div class="modal-header">
                <h3>${title}</h3>
            </div>
            <div class="modal-body">
                <p>${message}</p>
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline" id="confirm-cancel">Cancel</button>
                <button class="btn btn-primary" id="confirm-ok">OK</button>
            </div>
        </div>
    `;

  document.body.appendChild(modal);
  modal.classList.add("show");

  // Add event listeners
  modal.querySelector("#confirm-cancel").addEventListener("click", () => {
    modal.remove();
  });

  modal.querySelector("#confirm-ok").addEventListener("click", () => {
    modal.remove();
    confirmCallback();
  });

  // Close on outside click
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

// Add CSS for test interface
if (!document.querySelector("#test-styles")) {
  const style = document.createElement("style");
  style.id = "test-styles";
  style.textContent = `
        .test-mode {
            overflow: hidden;
            height: 100vh;
        }
        
        .question-btn.current {
            border-color: var(--primary);
            box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.3);
            transform: scale(1.1);
        }
        
        .question-btn.answered {
            background: var(--primary);
            color: white;
            border-color: var(--primary);
        }
        
        .question-btn.marked {
            background: var(--warning);
            color: white;
            border-color: var(--warning);
        }
        
        .option-label.selected {
            border-color: var(--primary);
            background: rgba(37, 99, 235, 0.05);
        }
        
        .timer.warning {
            animation: pulse 1s infinite;
            background: rgba(245, 158, 11, 0.2);
            color: var(--warning);
        }
        
        .timer.danger {
            animation: pulse 0.5s infinite;
            background: rgba(239, 68, 68, 0.2);
            color: var(--danger);
        }
        
        @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
        }
        
        #pause-overlay.show,
        #fullscreen-warning.show {
            display: flex !important;
            animation: fadeIn 0.3s ease;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        
        .modal.show {
            display: flex !important;
            animation: fadeIn 0.3s ease;
        }
    `;
  document.head.appendChild(style);
}
