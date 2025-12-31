// Results Page JavaScript - Updated for Real Backend

document.addEventListener("DOMContentLoaded", async function () {
  // Check authentication
  if (!PDFPracticePro.requireAuth()) return;

  // Get session ID from URL
  const urlParams = new URLSearchParams(window.location.search);
  const sessionId = urlParams.get("session");

  if (!sessionId) {
    PDFPracticePro.showNotification("No test results specified", "error");
    setTimeout(() => {
      window.location.href = "dashboard.html";
    }, 2000);
    return;
  }

  // Initialize results page
  await initResultsPage(sessionId);

  // Load test results
  await loadTestResults(sessionId);

  // Initialize charts
  initCharts();

  // Load topics performance
  await loadTopicsPerformance(sessionId);

  // Load questions review
  await loadQuestionsReview(sessionId);
});

async function initResultsPage(sessionId) {
  // Retake test button
  const retakeBtn = document.getElementById("retake-btn");
  if (retakeBtn) {
    retakeBtn.addEventListener("click", async () => {
      await retakeTest(sessionId);
    });
  }

  // Download report button
  const downloadReportBtn = document.getElementById("download-report-btn");
  if (downloadReportBtn) {
    downloadReportBtn.addEventListener("click", () => {
      downloadReport(sessionId);
    });
  }

  // Share results button
  const shareResultsBtn = document.getElementById("share-results-btn");
  const shareModal = document.getElementById("share-modal");
  const modalClose = document.querySelector(".modal-close");
  const copyLinkBtn = document.getElementById("copy-link-btn");

  if (shareResultsBtn) {
    shareResultsBtn.addEventListener("click", () => {
      if (shareModal) {
        shareModal.classList.add("show");
      }
    });
  }

  if (modalClose) {
    modalClose.addEventListener("click", () => {
      if (shareModal) {
        shareModal.classList.remove("show");
      }
    });
  }

  if (copyLinkBtn) {
    copyLinkBtn.addEventListener("click", copyShareLink);
  }

  // Close modal on outside click
  if (shareModal) {
    shareModal.addEventListener("click", (e) => {
      if (e.target === shareModal) {
        shareModal.classList.remove("show");
      }
    });
  }

  // Share buttons
  const shareBtns = document.querySelectorAll(".share-btn");
  shareBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const platform = btn.classList.contains("twitter")
        ? "twitter"
        : btn.classList.contains("linkedin")
        ? "linkedin"
        : "whatsapp";
      shareResults(platform);
    });
  });

  // Filter buttons
  const filterBtns = document.querySelectorAll(".filter-btn");
  filterBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      filterBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      filterQuestionsReview(btn.dataset.filter);
    });
  });

  // Question review toggle
  document.addEventListener("click", (e) => {
    if (e.target.closest(".review-header")) {
      const reviewItem = e.target.closest(".review-item");
      if (reviewItem) {
        reviewItem.classList.toggle("expanded");
      }
    }
  });
}

async function loadTestResults(sessionId) {
  try {
    const response = await PDFPracticePro.makeRequest(
      `/results/session/${sessionId}`
    );

    if (response && response.success) {
      window.testResults = response.results;
      window.questionsData = response.results.questions;

      // Update score summary
      updateScoreSummary(response.results);

      // Update circle progress
      const percentage = Math.round(
        (response.results.session.score / response.results.session.totalMarks) *
          100
      );
      updateCircleProgress(percentage);
    } else {
      throw new Error("Failed to load test results");
    }
  } catch (error) {
    console.error("Error loading test results:", error);
    PDFPracticePro.showNotification("Failed to load test results", "error");

    // Redirect to dashboard after 3 seconds
    setTimeout(() => {
      window.location.href = "dashboard.html";
    }, 3000);
  }
}

function updateScoreSummary(results) {
  const session = results.session;
  const summary = results.summary;

  // Calculate percentage
  const percentage = Math.round((session.score / session.totalMarks) * 100);

  // Update elements
  document.getElementById("score-percentage").textContent = `${percentage}%`;
  document.getElementById("total-marks").textContent = session.totalMarks;
  document.getElementById("obtained-marks").textContent = Math.round(
    session.score
  );
  document.getElementById("correct-count").textContent = summary.correct;
  document.getElementById("incorrect-count").textContent =
    summary.attempted - summary.correct;
  document.getElementById("accuracy-rate").textContent = `${Math.round(
    session.accuracy || 0
  )}%`;

  // Format time taken
  const timeTaken = PDFPracticePro.formatTime(summary.timeSpent);
  document.getElementById("time-taken").textContent = timeTaken;

  // Update test title in header
  const testTitle = document.querySelector(".header-main h1");
  if (testTitle && session.title) {
    testTitle.textContent = session.title;
  }
}

function updateCircleProgress(percentage) {
  const circle = document.querySelector(".circle-progress circle:last-child");
  if (circle) {
    const radius = 54;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percentage / 100) * circumference;
    circle.style.strokeDashoffset = offset;
  }
}

function initCharts() {
  if (!window.testResults) return;

  initDifficultyChart();
  initTimeChart();
}

function initDifficultyChart() {
  const ctx = document.getElementById("difficulty-chart");
  if (!ctx) return;

  const difficultyAnalysis = window.testResults.session.difficultyAnalysis;
  if (!difficultyAnalysis) return;

  const labels = ["Easy", "Medium", "Hard"];
  const data = [
    difficultyAnalysis.easy
      ? calculatePercentage(
          difficultyAnalysis.easy.correct,
          difficultyAnalysis.easy.total
        )
      : 0,
    difficultyAnalysis.medium
      ? calculatePercentage(
          difficultyAnalysis.medium.correct,
          difficultyAnalysis.medium.total
        )
      : 0,
    difficultyAnalysis.hard
      ? calculatePercentage(
          difficultyAnalysis.hard.correct,
          difficultyAnalysis.hard.total
        )
      : 0,
  ];

  new Chart(ctx.getContext("2d"), {
    type: "doughnut",
    data: {
      labels: labels,
      datasets: [
        {
          data: data,
          backgroundColor: [
            "rgba(16, 185, 129, 0.8)",
            "rgba(245, 158, 11, 0.8)",
            "rgba(239, 68, 68, 0.8)",
          ],
          borderColor: [
            "rgb(16, 185, 129)",
            "rgb(245, 158, 11)",
            "rgb(239, 68, 68)",
          ],
          borderWidth: 2,
          borderRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            padding: 20,
            usePointStyle: true,
            font: {
              size: 12,
            },
          },
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              const label = context.label || "";
              const value = context.parsed || 0;
              const total = getDifficultyTotal(context.dataIndex);
              return `${label}: ${value}% (${total} questions)`;
            },
          },
        },
      },
      cutout: "70%",
    },
  });

  function getDifficultyTotal(index) {
    const difficultyAnalysis = window.testResults.session.difficultyAnalysis;
    switch (index) {
      case 0:
        return difficultyAnalysis.easy?.total || 0;
      case 1:
        return difficultyAnalysis.medium?.total || 0;
      case 2:
        return difficultyAnalysis.hard?.total || 0;
      default:
        return 0;
    }
  }
}

function initTimeChart() {
  const ctx = document.getElementById("time-chart");
  if (!ctx) return;

  // Generate time data from questions
  const timeData = [];
  const labels = [];

  if (window.questionsData && window.questionsData.length > 0) {
    // Take first 20 questions or all if less
    const questionsToShow = window.questionsData.slice(
      0,
      Math.min(20, window.questionsData.length)
    );

    questionsToShow.forEach((q, index) => {
      labels.push(index + 1);
      timeData.push(q.timeSpent || 0);
    });
  }

  new Chart(ctx.getContext("2d"), {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Time per Question (seconds)",
          data: timeData,
          backgroundColor: timeData.map((time) => {
            if (time < 60) return "rgba(16, 185, 129, 0.7)";
            if (time < 120) return "rgba(245, 158, 11, 0.7)";
            return "rgba(239, 68, 68, 0.7)";
          }),
          borderColor: timeData.map((time) => {
            if (time < 60) return "rgb(16, 185, 129)";
            if (time < 120) return "rgb(245, 158, 11)";
            return "rgb(239, 68, 68)";
          }),
          borderWidth: 1,
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              const seconds = context.parsed.y;
              const minutes = Math.floor(seconds / 60);
              const secs = seconds % 60;
              return `Time: ${minutes}:${secs.toString().padStart(2, "0")}`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: {
            display: false,
          },
          ticks: {
            maxTicksLimit: 10,
          },
          title: {
            display: true,
            text: "Question Number",
          },
        },
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: "Seconds",
          },
          ticks: {
            callback: function (value) {
              const minutes = Math.floor(value / 60);
              const seconds = value % 60;
              return minutes > 0
                ? `${minutes}:${seconds.toString().padStart(2, "0")}`
                : `${seconds}s`;
            },
          },
        },
      },
    },
  });
}

async function loadTopicsPerformance(sessionId) {
  const topicsList = document.getElementById("topics-list");
  if (!topicsList) return;

  try {
    const topics = window.testResults.session.topicsPerformance || [];

    // Clear container
    topicsList.innerHTML = "";

    if (topics.length === 0) {
      topicsList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-chart-pie" style="font-size: 2rem; color: var(--gray-light); margin-bottom: 10px;"></i>
                    <p>No topic performance data available</p>
                </div>
            `;
      return;
    }

    // Sort topics by accuracy (ascending for weak areas first)
    const sortedTopics = [...topics].sort((a, b) => a.accuracy - b.accuracy);

    // Add topic items
    sortedTopics.forEach((topic) => {
      const topicItem = document.createElement("div");

      let strength = "medium";
      if (topic.accuracy < 60) strength = "weak";
      if (topic.accuracy >= 80) strength = "strong";

      topicItem.className = `topic-item ${strength}`;
      topicItem.innerHTML = `
                <div class="topic-info">
                    <div class="topic-name">${topic.topic}</div>
                    <div class="topic-stats">
                        <span>${topic.total} questions</span>
                        <span>${topic.correct} correct</span>
                    </div>
                </div>
                <div class="topic-score ${strength}">${Math.round(
        topic.accuracy
      )}%</div>
            `;

      topicsList.appendChild(topicItem);
    });
  } catch (error) {
    console.error("Error loading topics performance:", error);
    topicsList.innerHTML = '<div class="error">Failed to load topics</div>';
  }
}

async function loadQuestionsReview(sessionId) {
  const questionsReview = document.getElementById("questions-review");
  if (!questionsReview) return;

  try {
    if (!window.questionsData || window.questionsData.length === 0) {
      questionsReview.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-inbox" style="font-size: 2rem; color: var(--gray-light); margin-bottom: 10px;"></i>
                    <p>No questions available for review</p>
                </div>
            `;
      return;
    }

    renderQuestionsReview(window.questionsData);
  } catch (error) {
    console.error("Error loading questions review:", error);
    questionsReview.innerHTML =
      '<div class="error">Failed to load questions</div>';
  }
}

function renderQuestionsReview(questions) {
  const questionsReview = document.getElementById("questions-review");
  if (!questionsReview) return;

  questionsReview.innerHTML = "";

  questions.forEach((q, index) => {
    const reviewItem = document.createElement("div");

    // Determine question status
    let status = "skipped";
    if (q.userAnswer) {
      status = q.isCorrect ? "correct" : "incorrect";
    }

    // Check if marked for review
    const isMarked = q.markedForReview || false;

    reviewItem.className = `review-item ${status} ${isMarked ? "marked" : ""}`;
    reviewItem.dataset.id = q._id;
    reviewItem.dataset.status = status;
    reviewItem.dataset.marked = isMarked;

    // Find selected option
    const selectedOption = q.options?.find(
      (opt) => opt.optionId === q.userAnswer?.selectedOption
    );
    const correctOption = q.options?.find((opt) => opt.isCorrect);

    // Truncate question text for preview
    const previewText =
      q.questionText?.length > 100
        ? q.questionText.substring(0, 100) + "..."
        : q.questionText || "No question text";

    reviewItem.innerHTML = `
            <div class="review-header">
                <div class="review-question">
                    <div class="question-number">${index + 1}</div>
                    <div class="question-text-preview">${previewText}</div>
                </div>
                <div class="review-meta">
                    <span class="review-status ${status}">
                        ${status.charAt(0).toUpperCase() + status.slice(1)}
                    </span>
                    <span class="time-spent">${PDFPracticePro.formatTime(
                      q.timeSpent || 0
                    )}</span>
                    <button class="toggle-btn">
                        <i class="fas fa-chevron-down"></i>
                    </button>
                </div>
            </div>
            <div class="review-content">
                <div class="review-question-full">
                    <p>${q.questionText || "No question text available"}</p>
                </div>
                <div class="review-options">
                    ${
                      q.options
                        ?.map((opt) => {
                          let classes = "review-option";
                          if (opt.isCorrect) classes += " correct";
                          if (opt.optionId === q.userAnswer?.selectedOption)
                            classes += " selected";
                          if (
                            opt.optionId === q.userAnswer?.selectedOption &&
                            !opt.isCorrect
                          )
                            classes += " incorrect";

                          return `
                            <div class="${classes}">
                                <div class="option-label">${opt.optionId}</div>
                                <div class="option-text">${opt.text || ""}</div>
                            </div>
                        `;
                        })
                        .join("") ||
                      '<div class="no-options">No options available</div>'
                    }
                </div>
                ${
                  q.explanation
                    ? `
                <div class="review-explanation">
                    <div class="explanation-title">
                        <i class="fas fa-lightbulb"></i>
                        <span>Explanation</span>
                    </div>
                    <div class="explanation-content">${q.explanation}</div>
                </div>
                `
                    : ""
                }
            </div>
        `;

    questionsReview.appendChild(reviewItem);
  });
}

function filterQuestionsReview(filter) {
  if (!window.questionsData) return;

  let filteredQuestions = window.questionsData;

  switch (filter) {
    case "incorrect":
      filteredQuestions = window.questionsData.filter(
        (q) => q.userAnswer && !q.isCorrect
      );
      break;
    case "marked":
      filteredQuestions = window.questionsData.filter((q) => q.markedForReview);
      break;
    case "skipped":
      filteredQuestions = window.questionsData.filter((q) => !q.userAnswer);
      break;
    case "correct":
      filteredQuestions = window.questionsData.filter((q) => q.isCorrect);
      break;
  }

  renderQuestionsReview(filteredQuestions);
}

async function retakeTest(sessionId) {
  try {
    // Get PDF ID from test session
    const pdfId = window.testResults.session.pdfUploadId?._id;
    if (!pdfId) {
      throw new Error("Cannot retake test: PDF not found");
    }

    // Start a new test from the same PDF
    const response = await PDFPracticePro.makeRequest("/test/start", "POST", {
      pdfId: pdfId,
      timeLimit: window.testResults.session.timeLimit,
    });

    if (response && response.success) {
      // Redirect to new test
      window.location.href = `test.html?session=${response.session.sessionId}`;
    }
  } catch (error) {
    console.error("Error retaking test:", error);
    PDFPracticePro.showNotification("Failed to retake test", "error");
  }
}

async function downloadReport(sessionId) {
  try {
    PDFPracticePro.showNotification("Generating report...", "info");

    // Fetch report in CSV format
    const response = await PDFPracticePro.makeRequest(
      `/results/export/${sessionId}?format=csv`
    );

    if (response && response.success) {
      // Create blob and download
      const blob = new Blob([response], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `test-results-${sessionId}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      PDFPracticePro.showNotification(
        "Report downloaded successfully!",
        "success"
      );
    }
  } catch (error) {
    console.error("Error downloading report:", error);
    PDFPracticePro.showNotification("Failed to download report", "error");
  }
}

function copyShareLink() {
  const linkInput = document.getElementById("share-link-input");
  if (!linkInput) return;

  linkInput.select();
  linkInput.setSelectionRange(0, 99999); // For mobile

  navigator.clipboard
    .writeText(linkInput.value)
    .then(() => {
      PDFPracticePro.showNotification("Link copied to clipboard!", "success");
    })
    .catch((err) => {
      console.error("Failed to copy: ", err);
      PDFPracticePro.showNotification("Failed to copy link", "error");
    });
}

function shareResults(platform) {
  const score =
    document.getElementById("score-percentage")?.textContent || "0%";
  const title = "PDF Practice Pro Test Results";
  const text = `I scored ${score} on my practice test! Try PDF Practice Pro to improve your exam preparation.`;
  const url = window.location.href;

  let shareUrl = "";

  switch (platform) {
    case "twitter":
      shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
        text
      )}&url=${encodeURIComponent(url)}`;
      break;
    case "linkedin":
      shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
        url
      )}`;
      break;
    case "whatsapp":
      shareUrl = `https://wa.me/?text=${encodeURIComponent(text + " " + url)}`;
      break;
  }

  if (shareUrl) {
    window.open(shareUrl, "_blank", "width=600,height=400");
    PDFPracticePro.showNotification(`Sharing on ${platform}...`, "success");
  }
}

// Helper functions
function calculatePercentage(part, total) {
  if (!total || total === 0) return 0;
  return Math.round((part / total) * 100);
}

function formatTime(seconds) {
  if (!seconds) return "0:00";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  } else {
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  }
}

// Add CSS for results page
if (!document.querySelector("#results-styles")) {
  const style = document.createElement("style");
  style.id = "results-styles";
  style.textContent = `
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
        
        .topic-item.weak {
            border-left-color: var(--danger);
            background: rgba(239, 68, 68, 0.05);
        }
        
        .topic-item.medium {
            border-left-color: var(--warning);
            background: rgba(245, 158, 11, 0.05);
        }
        
        .topic-item.strong {
            border-left-color: var(--success);
            background: rgba(16, 185, 129, 0.05);
        }
        
        .topic-score.weak {
            color: var(--danger);
        }
        
        .topic-score.medium {
            color: var(--warning);
        }
        
        .topic-score.strong {
            color: var(--success);
        }
        
        .review-item.expanded .review-content {
            padding: 30px;
            max-height: 1000px;
        }
        
        .review-content {
            padding: 0;
            max-height: 0;
            overflow: hidden;
            transition: all 0.3s ease;
        }
        
        .no-options {
            padding: 20px;
            text-align: center;
            color: var(--gray);
            font-style: italic;
        }
        
        .review-option.correct {
            border-color: var(--success);
            background: rgba(16, 185, 129, 0.05);
        }
        
        .review-option.selected {
            border-color: var(--primary);
            background: rgba(37, 99, 235, 0.05);
        }
        
        .review-option.incorrect {
            border-color: var(--danger);
            background: rgba(239, 68, 68, 0.05);
        }
        
        .review-option.correct .option-label {
            background: var(--success);
            color: white;
        }
        
        .review-option.selected .option-label {
            background: var(--primary);
            color: white;
        }
        
        .review-option.incorrect .option-label {
            background: var(--danger);
            color: white;
        }
        
        .review-status.correct {
            background: rgba(16, 185, 129, 0.1);
            color: var(--success);
        }
        
        .review-status.incorrect {
            background: rgba(239, 68, 68, 0.1);
            color: var(--danger);
        }
        
        .review-status.skipped {
            background: rgba(107, 114, 128, 0.1);
            color: var(--gray);
        }
        
        .review-status.marked {
            background: rgba(245, 158, 11, 0.1);
            color: var(--warning);
        }
        
        .share-btn.twitter {
            background: #1DA1F2;
            color: white;
        }
        
        .share-btn.linkedin {
            background: #0077B5;
            color: white;
        }
        
        .share-btn.whatsapp {
            background: #25D366;
            color: white;
        }
        
        .share-btn {
            padding: 12px 20px;
            border: none;
            border-radius: var(--radius);
            font-weight: 600;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            transition: var(--transition);
        }
        
        .share-btn:hover {
            opacity: 0.9;
            transform: translateY(-2px);
        }
        
        .link-container {
            display: flex;
            gap: 10px;
            margin-top: 10px;
        }
        
        .link-container input {
            flex: 1;
            padding: 10px 15px;
            border: 2px solid var(--gray-light);
            border-radius: var(--radius);
            font-size: 0.9rem;
            background: var(--light);
        }
    `;
  document.head.appendChild(style);
}
