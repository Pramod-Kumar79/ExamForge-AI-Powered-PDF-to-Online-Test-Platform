// Upload Page JavaScript - Updated for Real Backend

document.addEventListener("DOMContentLoaded", function () {
  // Check authentication
  if (!PDFPracticePro.requireAuth()) return;

  // Initialize upload page
  initUploadPage();

  // Load user's uploads
  loadUserUploads();

  // Fill year select
  fillYearSelect();
});

async function initUploadPage() {
  const uploadArea = document.getElementById("upload-area");
  const pdfInput = document.getElementById("pdf-input");
  const browseBtn = document.getElementById("browse-btn");
  const nextBtn = document.getElementById("next-btn");
  const prevBtn = document.getElementById("prev-btn");
  const stepIndicator = document.querySelectorAll(".step-dot");

  let currentStep = 1;
  let uploadedFile = null;
  let examDetails = {};
  let processingInterval = null;

  // Browse button click
  browseBtn.addEventListener("click", () => {
    pdfInput.click();
  });

  // File input change
  pdfInput.addEventListener("change", handleFileSelect);

  // Drag and drop functionality
  uploadArea.addEventListener("dragover", (e) => {
    e.preventDefault();
    uploadArea.classList.add("drag-over");
  });

  uploadArea.addEventListener("dragleave", () => {
    uploadArea.classList.remove("drag-over");
  });

  uploadArea.addEventListener("drop", (e) => {
    e.preventDefault();
    uploadArea.classList.remove("drag-over");

    if (e.dataTransfer.files.length) {
      const file = e.dataTransfer.files[0];
      handleFileSelect({ target: { files: [file] } });
    }
  });

  // Next button click
  nextBtn.addEventListener("click", goToNextStep);

  // Previous button click
  prevBtn.addEventListener("click", goToPrevStep);

  // Handle file selection
  async function handleFileSelect(e) {
    const files = e.target.files;
    if (!files.length) return;

    const file = files[0];

    // Validate file type
    if (file.type !== "application/pdf") {
      PDFPracticePro.showNotification("Please upload a PDF file", "error");
      return;
    }

    // Validate file size (50MB)
    if (file.size > 50 * 1024 * 1024) {
      PDFPracticePro.showNotification(
        "File size must be less than 50MB",
        "error"
      );
      return;
    }

    uploadedFile = file;

    // Show file info
    showFileInfo(file);

    // Enable next button
    nextBtn.disabled = false;

    PDFPracticePro.showNotification("PDF selected successfully!", "success");
  }

  function showFileInfo(file) {
    const uploadAreaHTML = `
            <div class="file-info">
                <div class="file-icon">
                    <i class="fas fa-file-pdf"></i>
                </div>
                <div class="file-details">
                    <h4>${file.name}</h4>
                    <p>${PDFPracticePro.formatFileSize(
                      file.size
                    )} • Ready to upload</p>
                </div>
                <button class="btn btn-outline btn-sm" id="change-file">
                    <i class="fas fa-redo"></i> Change
                </button>
            </div>
        `;

    uploadArea.innerHTML = uploadAreaHTML;
    uploadArea.style.padding = "30px";

    // Add change file button event
    document
      .getElementById("change-file")
      .addEventListener("click", resetUpload);
  }

  function resetUpload() {
    uploadedFile = null;
    pdfInput.value = "";

    uploadArea.innerHTML = `
            <div class="upload-icon">
                <i class="fas fa-cloud-upload-alt"></i>
            </div>
            <h3>Drag & Drop PDF File</h3>
            <p>or click to browse</p>
            <p class="upload-note">Maximum file size: 50MB • Supported: PDF only</p>
            <button class="btn btn-primary" id="browse-btn">
                <i class="fas fa-folder-open"></i> Browse Files
            </button>
        `;

    // Re-attach event listeners
    document.getElementById("browse-btn").addEventListener("click", () => {
      pdfInput.click();
    });

    nextBtn.disabled = true;
  }

  // Navigation functions
  async function goToNextStep() {
    if (currentStep === 1) {
      // Validate file uploaded
      if (!uploadedFile) {
        PDFPracticePro.showNotification(
          "Please upload a PDF file first",
          "error"
        );
        return;
      }

      // Move to step 2
      switchStep(2);

      // Update exam details from form
      updateExamDetails();
    } else if (currentStep === 2) {
      // Validate form
      if (!validateExamDetails()) {
        PDFPracticePro.showNotification(
          "Please fill all required exam details",
          "error"
        );
        return;
      }

      // Update exam details
      updateExamDetails();

      // Move to step 3 and start processing
      switchStep(3);

      // Start actual upload and processing
      await startUploadAndProcessing();

      // Disable navigation during processing
      nextBtn.disabled = true;
      prevBtn.disabled = true;
    } else if (currentStep === 3) {
      // Processing complete - redirect to review page
      const pdfId = sessionStorage.getItem("last_uploaded_pdf");
      if (pdfId) {
        window.location.href = `review.html?pdfId=${pdfId}`;
      }
    }
  }

  function goToPrevStep() {
    if (currentStep > 1) {
      switchStep(currentStep - 1);

      if (currentStep === 1) {
        prevBtn.disabled = true;
      }
    }
  }

  function switchStep(step) {
    // Hide all steps
    document.querySelectorAll(".wizard-step").forEach((stepEl) => {
      stepEl.classList.remove("active");
    });

    // Show target step
    document
      .getElementById(`step-${getStepName(step)}`)
      .classList.add("active");

    // Update step indicator
    stepIndicator.forEach((dot, index) => {
      if (index < step) {
        dot.classList.add("active");
      } else {
        dot.classList.remove("active");
      }
    });

    // Update button text
    if (step === 3) {
      nextBtn.innerHTML = 'Processing... <i class="fas fa-cog fa-spin"></i>';
      nextBtn.disabled = true;
    } else if (step === 2) {
      nextBtn.innerHTML = 'Upload & Process <i class="fas fa-arrow-right"></i>';
      nextBtn.disabled = false;
    } else {
      nextBtn.innerHTML = 'Next <i class="fas fa-arrow-right"></i>';
      nextBtn.disabled = !uploadedFile;
    }

    // Update previous button
    prevBtn.disabled = step === 1;

    currentStep = step;
  }

  function getStepName(step) {
    const steps = ["", "upload", "details", "processing"];
    return steps[step];
  }

  // Form handling
  function updateExamDetails() {
    const examYearValue = document.getElementById("exam-year").value;

    examDetails = {
      examType: document.getElementById("exam-type").value,
      examYear: examYearValue
        ? parseInt(examYearValue)
        : new Date().getFullYear(),
      paperType: document.getElementById("paper-type").value,
      subject: document.getElementById("subject").value,
      paperTitle: document.getElementById("paper-title").value,
    };

    // Debug log
    console.log("Exam details being sent:", examDetails);
  }

  function validateExamDetails() {
    const required = ["examType", "paperType"];

    // Special validation for examYear (must be a valid number)
    const examYearElement = document.getElementById("exam-year");
    const examYearValue = examYearElement.value.trim();

    if (!examYearValue) {
      examYearElement.style.borderColor = "var(--danger)";
      examYearElement.style.animation = "shake 0.5s ease";
      setTimeout(() => {
        examYearElement.style.animation = "";
      }, 500);
      return false;
    }

    const examYear = parseInt(examYearValue);
    if (
      isNaN(examYear) ||
      examYear < 2000 ||
      examYear > new Date().getFullYear() + 1
    ) {
      examYearElement.style.borderColor = "var(--danger)";
      examYearElement.style.animation = "shake 0.5s ease";
      setTimeout(() => {
        examYearElement.style.animation = "";
      }, 500);
      return false;
    }

    // Reset style if valid
    examYearElement.style.borderColor = "";

    // Validate other required fields
    for (const field of required) {
      const element = document.getElementById(
        field.replace(/([A-Z])/g, "-$1").toLowerCase()
      );
      const value = element ? element.value.trim() : "";

      if (!value) {
        element.style.borderColor = "var(--danger)";
        element.style.animation = "shake 0.5s ease";
        setTimeout(() => {
          element.style.animation = "";
        }, 500);
        return false;
      }

      // Reset style if valid
      element.style.borderColor = "";
    }

    return true;
  }

  // Actual upload and processing
  async function startUploadAndProcessing() {
    const progressBar = document
      .getElementById("progress-bar")
      .querySelector(".progress-fill");
    const progressText = document.getElementById("progress-text");
    const processingSteps = document.querySelectorAll(".processing-step");
    const etaTime = document.getElementById("eta-time");

    try {
      // Create FormData for upload
      const formData = new FormData();
      formData.append("pdf", uploadedFile);
      formData.append("examType", examDetails.examType);
      formData.append("examYear", examDetails.examYear);
      formData.append("paperType", examDetails.paperType);
      formData.append("subject", examDetails.subject || "");
      formData.append("paperTitle", examDetails.paperTitle || "");

      // Update UI for uploading
      updateProcessingStep(0, processingSteps);
      updateProgress(10, progressBar, progressText, "Uploading PDF...");

      // Upload file
      const uploadResponse = await PDFPracticePro.uploadFile(
        uploadedFile,
        formData, // Pass the complete FormData
        (percent) => {
          updateProgress(
            10 + percent * 0.3,
            progressBar,
            progressText,
            `Uploading: ${Math.round(percent)}%`
          );
        }
      );

      if (!uploadResponse || !uploadResponse.success) {
        throw new Error(uploadResponse?.error || "Upload failed");
      }

      // Store PDF ID for later use
      const pdfId = uploadResponse.pdfUpload.id;
      sessionStorage.setItem("last_uploaded_pdf", pdfId);

      // Update UI for processing
      updateProcessingStep(1, processingSteps);
      updateProgress(40, progressBar, progressText, "Processing PDF...");

      // Start polling for processing status
      await pollProcessingStatus(
        pdfId,
        progressBar,
        progressText,
        processingSteps
      );

      // Processing complete
      updateProcessingStep(3, processingSteps);
      updateProgress(100, progressBar, progressText, "Complete!");

      // Update next button
      nextBtn.innerHTML = 'Review Questions <i class="fas fa-arrow-right"></i>';
      nextBtn.disabled = false;
      nextBtn.onclick = () => {
        window.location.href = `review.html?pdfId=${pdfId}`;
      };

      // Enable previous button
      prevBtn.disabled = false;

      PDFPracticePro.showNotification("PDF processing complete!", "success");
    } catch (error) {
      console.error("Upload/processing error:", error);
      PDFPracticePro.showNotification(`Error: ${error.message}`, "error");

      // Reset to step 1
      switchStep(1);
      resetUpload();
    }
  }

  async function pollProcessingStatus(
    pdfId,
    progressBar,
    progressText,
    processingSteps
  ) {
    let attempts = 0;
    const maxAttempts = 300; // 5 minutes max (1 second intervals)

    return new Promise((resolve, reject) => {
      const checkStatus = async () => {
        attempts++;

        if (attempts > maxAttempts) {
          reject(new Error("Processing timeout"));
          return;
        }

        try {
          const response = await PDFPracticePro.makeRequest(
            `/upload/${pdfId}/status`
          );

          if (response && response.success) {
            const pdfUpload = response.pdfUpload;

            // Update progress
            const progress = pdfUpload.processingProgress || 0;
            updateProgress(
              40 + progress * 0.6, // 40-100% range
              progressBar,
              progressText,
              `Processing: ${progress}%`
            );

            // Update processing step
            if (progress < 30) {
              updateProcessingStep(1, processingSteps);
            } else if (progress < 70) {
              updateProcessingStep(2, processingSteps);
            } else {
              updateProcessingStep(3, processingSteps);
            }

            // Check if completed
            if (pdfUpload.status === "completed") {
              resolve(pdfUpload);
              return;
            }

            // Check if failed
            if (pdfUpload.status === "failed") {
              reject(
                new Error(pdfUpload.processingError || "Processing failed")
              );
              return;
            }

            // Continue polling
            setTimeout(checkStatus, 1000);
          } else {
            reject(new Error("Failed to check status"));
          }
        } catch (error) {
          // Continue polling even if there's a temporary error
          console.warn("Status check error:", error);
          setTimeout(checkStatus, 2000);
        }
      };

      // Start polling
      checkStatus();
    });
  }

  function updateProgress(percent, progressBar, progressText, message = "") {
    const clampedPercent = Math.min(100, Math.max(0, percent));

    if (progressBar) {
      progressBar.style.width = `${clampedPercent}%`;
    }

    if (progressText) {
      progressText.textContent = `${Math.round(clampedPercent)}%`;
      if (message) {
        progressText.setAttribute("title", message);
      }
    }

    // Update ETA (simple estimation)
    const etaElement = document.getElementById("eta-time");
    if (etaElement) {
      const remaining = 100 - clampedPercent;
      const etaMinutes = Math.max(1, Math.ceil(remaining / 10)); // 10% per minute
      etaElement.textContent = `${etaMinutes} minute${
        etaMinutes !== 1 ? "s" : ""
      }`;
    }
  }

  function updateProcessingStep(stepIndex, processingSteps) {
    processingSteps.forEach((step, index) => {
      if (index <= stepIndex) {
        step.classList.add("active");
      } else {
        step.classList.remove("active");
      }
    });
  }
}

// Helper functions
function fillYearSelect() {
  const yearSelect = document.getElementById("exam-year");
  if (!yearSelect) return;

  const currentYear = new Date().getFullYear();

  // Clear existing options
  yearSelect.innerHTML = '<option value="">Select Year</option>';

  // Add years from 2000 to current year + 1
  for (let year = 2000; year <= currentYear + 1; year++) {
    const option = document.createElement("option");
    option.value = year;
    option.textContent = year;
    yearSelect.appendChild(option);
  }

  // Set default to current year
  yearSelect.value = currentYear;
}

async function loadUserUploads() {
  const recentList = document.getElementById("recent-list");
  if (!recentList) return;

  try {
    // Show loading state
    recentList.innerHTML = '<div class="loading">Loading your uploads...</div>';

    // Fetch user's uploads
    const response = await PDFPracticePro.makeRequest("/upload?limit=5");

    if (response && response.success) {
      const uploads = response.uploads;

      // Clear loading state
      recentList.innerHTML = "";

      if (uploads.length === 0) {
        recentList.innerHTML =
          '<div class="empty-state">No uploads yet. Upload your first PDF!</div>';
        return;
      }

      // Add uploads to list
      uploads.forEach((upload) => {
        const item = document.createElement("div");
        item.className = "recent-item";

        const statusClass = getStatusClass(upload.status);
        const statusText = getStatusText(upload.status);

        item.innerHTML = `
                    <div class="recent-icon ${statusClass}">
                        <i class="fas fa-file-pdf"></i>
                    </div>
                    <div class="recent-info">
                        <div class="recent-name">${upload.originalName}</div>
                        <div class="recent-meta">
                            <span>${PDFPracticePro.formatDate(
                              upload.createdAt
                            )}</span>
                            <span>${upload.examType.toUpperCase()}</span>
                            <span class="status-${
                              upload.status
                            }">${statusText}</span>
                        </div>
                    </div>
                    <a href="${getActionLink(upload)}" class="recent-action">
                        ${getActionText(upload)}
                    </a>
                `;

        recentList.appendChild(item);
      });
    }
  } catch (error) {
    console.error("Error loading uploads:", error);
    recentList.innerHTML = '<div class="error">Failed to load uploads</div>';
  }
}

function getStatusClass(status) {
  const statusClasses = {
    completed: "success",
    processing: "warning",
    failed: "danger",
    uploading: "info",
    review_needed: "warning",
  };
  return statusClasses[status] || "info";
}

function getStatusText(status) {
  const statusTexts = {
    completed: "Ready",
    processing: "Processing",
    failed: "Failed",
    uploading: "Uploading",
    review_needed: "Review Needed",
  };
  return statusTexts[status] || status;
}

function getActionLink(upload) {
  if (upload.status === "completed") {
    return `review.html?pdfId=${upload._id}`;
  } else if (upload.status === "processing") {
    return `upload.html?view=${upload._id}`;
  } else {
    return "#";
  }
}

function getActionText(upload) {
  if (upload.status === "completed") {
    return "Review";
  } else if (upload.status === "processing") {
    return "View Progress";
  } else {
    return "Details";
  }
}

// Make updatePDFProgress available globally for Socket.IO updates
window.updatePDFProgress = function (pdfId, progress) {
  // Update progress if we're monitoring this PDF
  const currentPdfId = sessionStorage.getItem("current_processing_pdf");
  if (currentPdfId === pdfId) {
    const progressBar = document
      .getElementById("progress-bar")
      ?.querySelector(".progress-fill");
    const progressText = document.getElementById("progress-text");

    if (progressBar && progressText) {
      const adjustedProgress = 40 + progress * 0.6; // 40-100% range
      progressBar.style.width = `${adjustedProgress}%`;
      progressText.textContent = `${Math.round(adjustedProgress)}%`;
    }
  }
};

// Add shake animation for form errors
if (!document.querySelector("#shake-animation")) {
  const style = document.createElement("style");
  style.id = "shake-animation";
  style.textContent = `
        @keyframes shake {
            0%, 100% { transform: translateX(0); }
            10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
            20%, 40%, 60%, 80% { transform: translateX(5px); }
        }
        
        .loading {
            text-align: center;
            padding: 20px;
            color: var(--gray);
        }
        
        .empty-state {
            text-align: center;
            padding: 30px;
            color: var(--gray);
            font-style: italic;
        }
        
        .error {
            text-align: center;
            padding: 20px;
            color: var(--danger);
        }
        
        .recent-icon.success {
            background: var(--success);
            color: white;
        }
        
        .recent-icon.warning {
            background: var(--warning);
            color: white;
        }
        
        .recent-icon.danger {
            background: var(--danger);
            color: white;
        }
        
        .recent-icon.info {
            background: var(--primary);
            color: white;
        }
    `;
  document.head.appendChild(style);
}
