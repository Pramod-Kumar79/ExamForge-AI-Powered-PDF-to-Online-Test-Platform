// Dashboard JavaScript - Updated for Real Backend

document.addEventListener("DOMContentLoaded", async function () {
  // Check authentication
  if (!PDFPracticePro.requireAuth("index.html")) return;

  // Initialize dashboard
  initDashboard();

  // Load dashboard data
  await loadDashboardData();

  // Initialize chart
  initPerformanceChart();

  // Load exam progress
  loadExamProgress();
});

async function initDashboard() {
  // User menu toggle
  const userMenuBtn = document.getElementById("user-menu-btn");
  const userDropdown = document.getElementById("user-dropdown");

  if (userMenuBtn && userDropdown) {
    userMenuBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      userDropdown.classList.toggle("show");
    });

    // Close dropdown when clicking outside
    document.addEventListener("click", (e) => {
      if (!userMenuBtn.contains(e.target) && !userDropdown.contains(e.target)) {
        userDropdown.classList.remove("show");
      }
    });
  }

  // Logout button
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", PDFPracticePro.handleLogout);
  }

  // Load user data
  await loadUserData();

  // Add goal modal
  const addGoalBtn = document.getElementById("add-goal-btn");
  const addGoalModal = document.getElementById("add-goal-modal");
  const modalClose = document.querySelector(".modal-close");
  const cancelGoalBtn = document.getElementById("cancel-goal-btn");
  const saveGoalBtn = document.getElementById("save-goal-btn");

  if (addGoalBtn && addGoalModal) {
    addGoalBtn.addEventListener("click", () => {
      addGoalModal.classList.add("show");
    });

    const closeModal = () => {
      addGoalModal.classList.remove("show");
    };

    if (modalClose) modalClose.addEventListener("click", closeModal);
    if (cancelGoalBtn) cancelGoalBtn.addEventListener("click", closeModal);

    // Close modal on outside click
    addGoalModal.addEventListener("click", (e) => {
      if (e.target === addGoalModal) {
        closeModal();
      }
    });

    // Save goal button
    if (saveGoalBtn) {
      saveGoalBtn.addEventListener("click", saveGoal);
    }
  }

  // Priority selector
  const priorityBtns = document.querySelectorAll(".priority-btn");
  priorityBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      priorityBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById("goal-priority").value = btn.dataset.priority;
    });
  });

  // Exam filter buttons
  const filterBtns = document.querySelectorAll(".filter-btn");
  filterBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      filterBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      filterExamProgress(btn.dataset.exam);
    });
  });

  // Resume test button
  const resumeTestBtn = document.getElementById("resume-test-btn");
  if (resumeTestBtn) {
    resumeTestBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      await resumeLastTest();
    });
  }
}

async function loadUserData() {
  try {
    const response = await PDFPracticePro.makeRequest("/auth/me");

    if (response && response.success) {
      const user = response.user;

      // Update UI with user data
      document.getElementById("user-greeting").textContent =
        user.name.split(" ")[0];
      document.getElementById("username").textContent = user.name;

      // Update user stats if available
      if (response.progress) {
        updateUserStats(response.progress.stats);
      }
    }
  } catch (error) {
    console.error("Error loading user data:", error);
  }
}

function updateUserStats(stats) {
  if (!stats) return;

  document.getElementById("total-pdfs").textContent = stats.totalPDFs || "0";
  document.getElementById("total-time").textContent = Math.round(
    (stats.totalTimeSpent || 0) / 3600
  );
  document.getElementById("avg-score").textContent = `${Math.round(
    stats.averageScore || 0
  )}%`;
  document.getElementById("streak-days").textContent =
    stats.currentStreak || "0";
}

async function loadDashboardData() {
  try {
    // Load recent tests
    await loadRecentTests();

    // Load weak areas
    await loadWeakAreas();

    // Load goals
    await loadGoals();

    // Load analytics
    await loadAnalytics();
  } catch (error) {
    console.error("Error loading dashboard data:", error);
    PDFPracticePro.showNotification("Failed to load dashboard data", "error");
  }
}

async function loadRecentTests() {
  const recentTestsContainer = document.getElementById("recent-tests");
  if (!recentTestsContainer) return;

  try {
    // Show loading state
    recentTestsContainer.innerHTML =
      '<div class="loading">Loading recent tests...</div>';

    // Fetch recent test sessions
    const response = await PDFPracticePro.makeRequest(
      "/results/history?limit=4"
    );

    if (response && response.success) {
      const tests = response.tests;

      // Clear container
      recentTestsContainer.innerHTML = "";

      if (tests.length === 0) {
        recentTestsContainer.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-clipboard-list" style="font-size: 2rem; color: var(--gray-light); margin-bottom: 10px;"></i>
                        <p>No tests taken yet</p>
                        <a href="upload.html" class="btn btn-sm btn-primary" style="margin-top: 10px;">
                            Take Your First Test
                        </a>
                    </div>
                `;
        return;
      }

      // Add test items
      tests.forEach((test) => {
        const testItem = document.createElement("div");
        testItem.className = `test-item ${
          test.pdfUploadId?.examType || "general"
        }`;
        testItem.innerHTML = `
                    <div class="test-icon">
                        <i class="fas fa-file-alt"></i>
                    </div>
                    <div class="test-info">
                        <div class="test-name">${test.title}</div>
                        <div class="test-meta">
                            <span>${PDFPracticePro.formatDate(
                              test.submittedAt
                            )}</span>
                            <span>${Math.round(
                              test.timePerQuestion || 0
                            )}s/q</span>
                            <span class="test-score">${Math.round(
                              test.score || 0
                            )}/${test.totalQuestions * 2}</span>
                        </div>
                    </div>
                    <a href="results.html?session=${
                      test.sessionId
                    }" class="test-action">View</a>
                `;

        recentTestsContainer.appendChild(testItem);
      });
    }
  } catch (error) {
    console.error("Error loading recent tests:", error);
    recentTestsContainer.innerHTML =
      '<div class="error">Failed to load tests</div>';
  }
}

async function loadWeakAreas() {
  const weakAreasContainer = document.getElementById("weak-areas");
  if (!weakAreasContainer) return;

  try {
    // Fetch analytics data
    const response = await PDFPracticePro.makeRequest("/results/analytics");

    if (response && response.success) {
      const weakAreas = response.analytics.weakAreas || [];

      // Clear container
      weakAreasContainer.innerHTML = "";

      if (weakAreas.length === 0) {
        weakAreasContainer.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-check-circle" style="font-size: 2rem; color: var(--success); margin-bottom: 10px;"></i>
                        <p>No weak areas identified yet</p>
                    </div>
                `;
        return;
      }

      // Add weak area items (limit to 4)
      weakAreas.slice(0, 4).forEach((area) => {
        const weakArea = document.createElement("div");
        weakArea.className = "weak-area";
        weakArea.innerHTML = `
                    <div>
                        <h4>${area.topic}</h4>
                        <p>${
                          area.suggestedActions?.[0] ||
                          "Practice more questions"
                        }</p>
                    </div>
                    <div>
                        <div class="progress">
                            <div class="progress-fill" style="width: ${
                              area.accuracy || 50
                            }%"></div>
                        </div>
                        <p style="text-align: right; margin-top: 5px; font-size: 0.9rem; color: var(--danger);">
                            ${Math.round(area.accuracy || 0)}% accuracy
                        </p>
                    </div>
                `;

        weakAreasContainer.appendChild(weakArea);
      });
    }
  } catch (error) {
    console.error("Error loading weak areas:", error);
    weakAreasContainer.innerHTML =
      '<div class="error">Failed to load weak areas</div>';
  }
}

async function loadGoals() {
  const goalsList = document.getElementById("goals-list");
  if (!goalsList) return;

  try {
    // Fetch analytics data
    const response = await PDFPracticePro.makeRequest("/results/analytics");

    if (response && response.success) {
      const goals = response.analytics.goals || [];

      // Clear container
      goalsList.innerHTML = "";

      if (goals.length === 0) {
        goalsList.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-flag" style="font-size: 2rem; color: var(--gray-light); margin-bottom: 10px;"></i>
                        <p>No goals set yet</p>
                        <button class="btn btn-sm btn-primary" id="create-first-goal" style="margin-top: 10px;">
                            Create First Goal
                        </button>
                    </div>
                `;

        document
          .getElementById("create-first-goal")
          ?.addEventListener("click", () => {
            document.getElementById("add-goal-btn")?.click();
          });

        return;
      }

      // Add goal items (limit to 3)
      goals.slice(0, 3).forEach((goal) => {
        const progress =
          goal.current && goal.target
            ? Math.min((goal.current / goal.target) * 100, 100)
            : 0;
        const progressText =
          goal.current && goal.target
            ? `${goal.current}/${goal.target}`
            : "0/0";

        const goalItem = document.createElement("div");
        goalItem.className = `goal-item ${goal.priority || "medium"}`;
        goalItem.innerHTML = `
                    <div class="goal-check">
                        <input type="checkbox" ${
                          progress === 100 ? "checked" : ""
                        } disabled>
                    </div>
                    <div class="goal-content">
                        <h4>${goal.title}</h4>
                        <div class="goal-meta">
                            <span>${
                              goal.examType?.toUpperCase() || "General"
                            }</span>
                            <span>Due: ${PDFPracticePro.formatDate(
                              goal.deadline
                            )}</span>
                        </div>
                    </div>
                    <div class="goal-progress">
                        <div class="goal-progress-bar">
                            <div class="goal-progress-fill" style="width: ${progress}%"></div>
                        </div>
                        <div class="goal-progress-text">${progressText}</div>
                    </div>
                `;

        goalsList.appendChild(goalItem);
      });
    }
  } catch (error) {
    console.error("Error loading goals:", error);
    goalsList.innerHTML = '<div class="error">Failed to load goals</div>';
  }
}

async function loadAnalytics() {
  // This function loads additional analytics data
  // Currently handled by initPerformanceChart
}

function loadExamProgress() {
  // This would fetch exam-specific progress from the backend
  // For now, using mock data
  const examProgressContainer = document.getElementById("exam-progress");
  if (!examProgressContainer) return;

  // Sample data - in production, fetch from /results/analytics
  const examProgress = [
    {
      exam: "upsc",
      name: "UPSC Civil Services",
      tests: 15,
      questions: 1250,
      avgScore: 72,
      progress: 45,
    },
    {
      exam: "ssc",
      name: "SSC CGL/CHSL",
      tests: 22,
      questions: 1980,
      avgScore: 78,
      progress: 68,
    },
    {
      exam: "jee",
      name: "JEE Main/Advanced",
      tests: 18,
      questions: 1620,
      avgScore: 85,
      progress: 52,
    },
    {
      exam: "banking",
      name: "Banking Exams",
      tests: 12,
      questions: 960,
      avgScore: 65,
      progress: 35,
    },
  ];

  // Clear container
  examProgressContainer.innerHTML = "";

  // Add exam cards
  examProgress.forEach((exam) => {
    const examCard = document.createElement("div");
    examCard.className = "exam-card";
    examCard.dataset.exam = exam.exam;
    examCard.innerHTML = `
            <div class="exam-header">
                <div class="exam-icon ${exam.exam}">
                    <i class="fas fa-graduation-cap"></i>
                </div>
                <div class="exam-title">
                    <h4>${exam.name}</h4>
                    <p>Comprehensive preparation tracker</p>
                </div>
            </div>
            <div class="exam-stats">
                <div class="exam-stat">
                    <span class="exam-stat-value">${exam.tests}</span>
                    <span class="exam-stat-label">Tests</span>
                </div>
                <div class="exam-stat">
                    <span class="exam-stat-value">${exam.questions}</span>
                    <span class="exam-stat-label">Questions</span>
                </div>
                <div class="exam-stat">
                    <span class="exam-stat-value">${exam.avgScore}%</span>
                    <span class="exam-stat-label">Avg Score</span>
                </div>
            </div>
            <div class="exam-progress">
                <div class="exam-progress-bar">
                    <div class="exam-progress-fill" style="width: ${exam.progress}%"></div>
                </div>
                <div class="exam-progress-text">
                    <span>Progress</span>
                    <span>${exam.progress}%</span>
                </div>
            </div>
        `;

    examProgressContainer.appendChild(examCard);
  });
}

function filterExamProgress(examType) {
  const examCards = document.querySelectorAll(".exam-card");

  examCards.forEach((card) => {
    if (examType === "all" || card.dataset.exam === examType) {
      card.style.display = "block";
    } else {
      card.style.display = "none";
    }
  });
}

function initPerformanceChart() {
  const ctx = document.getElementById("performance-chart");
  if (!ctx) return;

  // Fetch performance data from backend
  fetchPerformanceData().then((trendData) => {
    const labels = trendData.map((item) => {
      const date = new Date(item.date);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    });

    const scores = trendData.map((item) => item.score);

    // Create chart
    const chart = new Chart(ctx.getContext("2d"), {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Average Score (%)",
            data: scores,
            borderColor: "rgba(37, 99, 235, 1)",
            backgroundColor: "rgba(37, 99, 235, 0.1)",
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            pointBackgroundColor: "rgba(37, 99, 235, 1)",
            pointBorderColor: "#fff",
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6,
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
            backgroundColor: "rgba(31, 41, 55, 0.9)",
            titleColor: "#fff",
            bodyColor: "#fff",
            borderColor: "rgba(37, 99, 235, 1)",
            borderWidth: 1,
            cornerRadius: 6,
          },
        },
        scales: {
          x: {
            grid: {
              color: "rgba(229, 231, 235, 0.5)",
            },
            ticks: {
              color: "var(--gray)",
              maxTicksLimit: 10,
            },
          },
          y: {
            beginAtZero: false,
            min: Math.max(0, Math.min(...scores) - 10),
            max: Math.min(100, Math.max(...scores) + 10),
            grid: {
              color: "rgba(229, 231, 235, 0.5)",
            },
            ticks: {
              color: "var(--gray)",
              callback: function (value) {
                return value + "%";
              },
            },
          },
        },
        interaction: {
          intersect: false,
          mode: "index",
        },
      },
    });

    // Update chart when period changes
    const chartPeriod = document.getElementById("chart-period");
    if (chartPeriod) {
      chartPeriod.addEventListener("change", async function () {
        const newTrendData = await fetchPerformanceData(this.value);
        updateChartData(chart, newTrendData);
      });
    }
  });
}

async function fetchPerformanceData(period = "30d") {
  try {
    // In production, fetch from /results/analytics with period filter
    // For now, generate sample data
    let days;
    switch (period) {
      case "7d":
        days = 7;
        break;
      case "30d":
        days = 30;
        break;
      case "90d":
        days = 90;
        break;
      default:
        days = 30;
    }

    const trendData = [];
    const today = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);

      trendData.push({
        date: date.toISOString().split("T")[0],
        score: Math.floor(Math.random() * 30) + 65, // 65-95%
        accuracy: Math.floor(Math.random() * 30) + 65,
      });
    }

    return trendData;
  } catch (error) {
    console.error("Error fetching performance data:", error);
    return [];
  }
}

function updateChartData(chart, trendData) {
  const labels = trendData.map((item) => {
    const date = new Date(item.date);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  });

  const scores = trendData.map((item) => item.score);

  chart.data.labels = labels;
  chart.data.datasets[0].data = scores;
  chart.update();
}

async function saveGoal() {
  const title = document.getElementById("goal-title").value.trim();
  const exam = document.getElementById("goal-exam").value;
  const target = parseInt(document.getElementById("goal-target").value);
  const deadline = document.getElementById("goal-deadline").value;
  const priority = document.getElementById("goal-priority").value;

  if (!title || !exam || !target || !deadline || target <= 0) {
    PDFPracticePro.showNotification(
      "Please fill all required fields correctly",
      "error"
    );
    return;
  }

  if (new Date(deadline) < new Date()) {
    PDFPracticePro.showNotification("Deadline must be in the future", "error");
    return;
  }

  try {
    // In production, save to backend
    // For now, save to localStorage
    const goals = JSON.parse(localStorage.getItem("user_goals") || "[]");

    const newGoal = {
      id: Date.now().toString(),
      title,
      examType: exam,
      target,
      current: 0,
      unit: "questions",
      deadline,
      priority,
      status: "active",
      createdAt: new Date().toISOString(),
    };

    goals.push(newGoal);
    localStorage.setItem("user_goals", JSON.stringify(goals));

    PDFPracticePro.showNotification("Goal added successfully!", "success");

    // Close modal
    document.getElementById("add-goal-modal").classList.remove("show");

    // Reset form
    document.getElementById("goal-form").reset();

    // Reload goals
    await loadGoals();
  } catch (error) {
    console.error("Error saving goal:", error);
    PDFPracticePro.showNotification("Failed to save goal", "error");
  }
}

async function resumeLastTest() {
  try {
    // Fetch recent test sessions
    const response = await PDFPracticePro.makeRequest(
      "/results/history?limit=1"
    );

    if (response && response.success && response.tests.length > 0) {
      const lastTest = response.tests[0];

      // Check if the test was completed
      if (lastTest.status === "completed") {
        PDFPracticePro.showNotification(
          "No active test to resume. Start a new test!",
          "info"
        );
        return;
      }

      // Redirect to test page
      window.location.href = `test.html?session=${lastTest.sessionId}`;
    } else {
      PDFPracticePro.showNotification(
        "No test to resume. Start a new test!",
        "info"
      );
    }
  } catch (error) {
    console.error("Error resuming test:", error);
    PDFPracticePro.showNotification("Failed to resume test", "error");
  }
}

// Add CSS for loading states
if (!document.querySelector("#dashboard-styles")) {
  const style = document.createElement("style");
  style.id = "dashboard-styles";
  style.textContent = `
        .loading {
            text-align: center;
            padding: 30px;
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
        
        .empty-state p {
            margin-bottom: 15px;
        }
        
        .error {
            text-align: center;
            padding: 20px;
            color: var(--danger);
            font-style: italic;
        }
        
        .test-item.general {
            border-left-color: var(--gray);
        }
        
        .exam-icon.general {
            background: linear-gradient(135deg, var(--gray), #9CA3AF);
        }
    `;
  document.head.appendChild(style);
}
