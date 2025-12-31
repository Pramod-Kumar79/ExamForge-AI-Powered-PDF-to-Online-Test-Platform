// Main JavaScript File - Updated for Real Backend Integration

const API_BASE_URL = "http://localhost:3001/api"; // Change to your backend URL

document.addEventListener("DOMContentLoaded", function () {
  // Mobile Menu Toggle
  const menuToggle = document.querySelector(".menu-toggle");
  const navLinks = document.querySelector(".nav-links");

  if (menuToggle && navLinks) {
    menuToggle.addEventListener("click", function () {
      navLinks.style.display =
        navLinks.style.display === "flex" ? "none" : "flex";
      if (navLinks.style.display === "flex") {
        navLinks.style.flexDirection = "column";
        navLinks.style.position = "absolute";
        navLinks.style.top = "100%";
        navLinks.style.left = "0";
        navLinks.style.right = "0";
        navLinks.style.backgroundColor = "white";
        navLinks.style.padding = "20px";
        navLinks.style.boxShadow = "0 10px 15px -3px rgba(0, 0, 0, 0.1)";
        navLinks.style.gap = "15px";
      }
    });
  }

  // Smooth Scrolling for Anchor Links
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", function (e) {
      e.preventDefault();
      const targetId = this.getAttribute("href");
      if (targetId === "#") return;

      const targetElement = document.querySelector(targetId);
      if (targetElement) {
        window.scrollTo({
          top: targetElement.offsetTop - 80,
          behavior: "smooth",
        });

        // Close mobile menu if open
        if (window.innerWidth <= 768 && navLinks) {
          navLinks.style.display = "none";
        }
      }
    });
  });

  // Initialize Tooltips
  initTooltips();

  // Initialize Notifications
  initNotifications();

  // Check Authentication Status
  checkAuthStatus();

  // Initialize Socket.IO for real-time updates
  initSocketIO();
});

// Socket.IO initialization
function initSocketIO() {
  if (window.io) {
    window.socket = io(API_BASE_URL.replace("/api", ""), {
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => {
      console.log("Socket connected:", socket.id);

      // Join user room if authenticated
      const userData = getUserData();
      if (userData && userData.id) {
        socket.emit("join-room", userData.id);
      }
    });

    socket.on("pdf-processing-update", (data) => {
      console.log("PDF processing update:", data);
      showNotification(`PDF processing: ${data.progress}% complete`, "info");

      // Update progress if on upload page
      if (window.updatePDFProgress) {
        window.updatePDFProgress(data.pdfId, data.progress);
      }
    });

    socket.on("pdf-processed", (data) => {
      console.log("PDF processed:", data);
      showNotification("PDF processing complete! Ready for review.", "success");

      // Redirect to review page if on upload page
      if (window.location.pathname.includes("upload.html")) {
        setTimeout(() => {
          window.location.href = `review.html?pdfId=${data.pdfId}`;
        }, 2000);
      }
    });

    socket.on("disconnect", () => {
      console.log("Socket disconnected");
    });
  }
}

// Tooltip Functionality
function initTooltips() {
  const tooltipElements = document.querySelectorAll("[data-tooltip]");

  tooltipElements.forEach((element) => {
    element.addEventListener("mouseenter", showTooltip);
    element.addEventListener("mouseleave", hideTooltip);
  });
}

function showTooltip(e) {
  const tooltipText = e.target.getAttribute("data-tooltip");
  if (!tooltipText) return;

  const tooltip = document.createElement("div");
  tooltip.className = "tooltip";
  tooltip.textContent = tooltipText;
  tooltip.style.position = "absolute";
  tooltip.style.backgroundColor = "var(--dark)";
  tooltip.style.color = "white";
  tooltip.style.padding = "5px 10px";
  tooltip.style.borderRadius = "4px";
  tooltip.style.fontSize = "0.8rem";
  tooltip.style.zIndex = "1000";
  tooltip.style.boxShadow = "0 2px 5px rgba(0,0,0,0.2)";

  document.body.appendChild(tooltip);

  const rect = e.target.getBoundingClientRect();
  tooltip.style.top = rect.top - tooltip.offsetHeight - 5 + "px";
  tooltip.style.left =
    rect.left + (rect.width - tooltip.offsetWidth) / 2 + "px";

  e.target.tooltipElement = tooltip;
}

function hideTooltip(e) {
  if (e.target.tooltipElement) {
    e.target.tooltipElement.remove();
    e.target.tooltipElement = null;
  }
}

// Notification System
function initNotifications() {
  // Create notification container
  const notificationContainer = document.createElement("div");
  notificationContainer.id = "notification-container";
  notificationContainer.style.position = "fixed";
  notificationContainer.style.top = "20px";
  notificationContainer.style.right = "20px";
  notificationContainer.style.zIndex = "9999";
  notificationContainer.style.maxWidth = "350px";
  document.body.appendChild(notificationContainer);
}

function showNotification(message, type = "info", duration = 5000) {
  const container = document.getElementById("notification-container");
  if (!container) return;

  const notification = document.createElement("div");
  notification.className = `notification notification-${type}`;
  notification.innerHTML = `
        <div class="notification-content">
            <i class="fas ${getNotificationIcon(type)}"></i>
            <span>${message}</span>
        </div>
        <button class="notification-close">&times;</button>
    `;

  // Add styles
  notification.style.cssText = `
        background: ${getNotificationColor(type)};
        color: white;
        padding: 15px 20px;
        margin-bottom: 10px;
        border-radius: 8px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: slideIn 0.3s ease;
    `;

  notification
    .querySelector(".notification-close")
    .addEventListener("click", () => {
      notification.style.animation = "slideOut 0.3s ease";
      setTimeout(() => notification.remove(), 300);
    });

  container.appendChild(notification);

  // Auto remove after duration
  if (duration > 0) {
    setTimeout(() => {
      if (notification.parentNode) {
        notification.style.animation = "slideOut 0.3s ease";
        setTimeout(() => notification.remove(), 300);
      }
    }, duration);
  }

  // Add animation keyframes
  if (!document.getElementById("notification-animations")) {
    const style = document.createElement("style");
    style.id = "notification-animations";
    style.textContent = `
            @keyframes slideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            @keyframes slideOut {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(100%);
                    opacity: 0;
                }
            }
        `;
    document.head.appendChild(style);
  }
}

function getNotificationIcon(type) {
  const icons = {
    success: "fa-check-circle",
    error: "fa-exclamation-circle",
    warning: "fa-exclamation-triangle",
    info: "fa-info-circle",
  };
  return icons[type] || "fa-info-circle";
}

function getNotificationColor(type) {
  const colors = {
    success: "var(--success)",
    error: "var(--danger)",
    warning: "var(--warning)",
    info: "var(--primary)",
  };
  return colors[type] || "var(--primary)";
}

// Authentication Helper Functions
function checkAuthStatus() {
  const token = localStorage.getItem("auth_token");
  const userData = localStorage.getItem("user_data");

  if (token && userData) {
    // User is logged in
    updateUIForLoggedInUser(JSON.parse(userData));

    // Verify token is still valid
    verifyToken(token);
  } else {
    // User is not logged in
    updateUIForLoggedOutUser();
  }
}

async function verifyToken(token) {
  try {
    const response = await makeRequest("/auth/me", "GET");
    if (response && response.success) {
      localStorage.setItem("user_data", JSON.stringify(response.user));
      updateUIForLoggedInUser(response.user);
    } else {
      localStorage.removeItem("auth_token");
      localStorage.removeItem("user_data");
      updateUIForLoggedOutUser();
    }
  } catch (error) {
    console.error("Token verification failed:", error);
    localStorage.removeItem("auth_token");
    localStorage.removeItem("user_data");
    updateUIForLoggedOutUser();
  }
}

function updateUIForLoggedInUser(userData) {
  // Update navigation for logged in user
  const navLinks = document.querySelector(".nav-links");
  if (navLinks) {
    // Find or create login button
    let loginBtn = navLinks.querySelector('a[href="login.html"]');
    if (!loginBtn) {
      loginBtn = navLinks.querySelector('a[href*="login"]');
    }

    if (loginBtn) {
      loginBtn.textContent = "Logout";
      loginBtn.href = "#";
      loginBtn.onclick = handleLogout;
    }

    // Update dashboard button
    const dashboardBtn = navLinks.querySelector('a[href="dashboard.html"]');
    if (dashboardBtn) {
      dashboardBtn.innerHTML = `<i class="fas fa-user-circle"></i> ${
        userData.name || "Dashboard"
      }`;
    }
  }

  // Update user-specific elements
  document.querySelectorAll("[data-user-name]").forEach((el) => {
    el.textContent = userData.name || "User";
  });

  document.querySelectorAll("[data-user-email]").forEach((el) => {
    el.textContent = userData.email || "";
  });
}

function updateUIForLoggedOutUser() {
  // Reset navigation to default
  const navLinks = document.querySelector(".nav-links");
  if (navLinks) {
    const loginBtn = navLinks.querySelector('a[href="#"]');
    if (loginBtn && loginBtn.onclick) {
      loginBtn.textContent = "Sign In";
      loginBtn.href = "login.html";
      loginBtn.onclick = null;
    }
  }
}

function handleLogout(e) {
  e.preventDefault();

  localStorage.removeItem("auth_token");
  localStorage.removeItem("user_data");

  showNotification("Logged out successfully", "success");

  setTimeout(() => {
    window.location.href = "index.html";
  }, 1000);
}

function getUserData() {
  const userData = localStorage.getItem("user_data");
  return userData ? JSON.parse(userData) : null;
}

function getAuthToken() {
  return localStorage.getItem("auth_token");
}

function isAuthenticated() {
  return !!localStorage.getItem("auth_token");
}

function requireAuth(redirectUrl = "index.html") {
  if (!isAuthenticated()) {
    showNotification("Please login to access this page", "warning");
    setTimeout(() => {
      window.location.href = redirectUrl;
    }, 1500);
    return false;
  }
  return true;
}

// API Helper Function
async function makeRequest(
  endpoint,
  method = "GET",
  data = null,
  options = {}
) {
  const token = getAuthToken();
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const config = {
    method,
    headers,
    ...options,
  };

  if (data && (method === "POST" || method === "PUT" || method === "PATCH")) {
    config.body = JSON.stringify(data);
  }

  try {
    const url = endpoint.startsWith("http")
      ? endpoint
      : `${API_BASE_URL}${endpoint}`;
    const response = await fetch(url, config);

    // Handle 401 Unauthorized
    if (response.status === 401) {
      localStorage.removeItem("auth_token");
      localStorage.removeItem("user_data");
      showNotification("Session expired. Please login again.", "warning");

      // Redirect to login if not already on login page
      if (
        !window.location.pathname.includes("login.html") &&
        !window.location.pathname.includes("index.html")
      ) {
        setTimeout(() => {
          window.location.href = `index.html?redirect=${encodeURIComponent(
            window.location.pathname
          )}`;
        }, 2000);
      }

      return null;
    }

    // Handle 403 Forbidden
    if (response.status === 403) {
      throw new Error("You do not have permission to perform this action");
    }

    // Handle 404 Not Found
    if (response.status === 404) {
      throw new Error("Resource not found");
    }

    // Handle 429 Rate Limited
    if (response.status === 429) {
      throw new Error("Too many requests. Please try again later.");
    }

    // Parse response
    const contentType = response.headers.get("content-type");
    let responseData;

    if (contentType && contentType.includes("application/json")) {
      responseData = await response.json();
    } else {
      responseData = await response.text();
    }

    if (!response.ok) {
      const errorMessage =
        responseData.error ||
        responseData.message ||
        `HTTP ${response.status}: ${response.statusText}`;
      throw new Error(errorMessage);
    }

    return responseData;
  } catch (error) {
    console.error("API Request Error:", error);

    // Don't show notification for network errors if offline
    if (!navigator.onLine) {
      showNotification(
        "You are offline. Please check your internet connection.",
        "error"
      );
    } else {
      showNotification(error.message, "error");
    }

    throw error;
  }
}

// File Upload Helper

// Replace the ENTIRE uploadFile function with this:
async function uploadFile(file, formData = null, onProgress = null) {
  const data = formData || new FormData();
  
 
  if (!data.has("pdf") && file) {
    data.append("pdf", file);
  }
 
  else if (!formData && file) {
    data.append("pdf", file);
  }

  const token = getAuthToken();

  // DEBUG: Log FormData contents
  console.log("📤 DEBUG: Uploading FormData with fields:");
  for (let [key, value] of data.entries()) {
    console.log(`   ${key}:`, value instanceof File ? `${value.name} (File)` : value);
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.open("POST", `${API_BASE_URL}/upload`);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable && onProgress) {
        const percentComplete = (event.loaded / event.total) * 100;
        onProgress(percentComplete);
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          console.log("✅ Upload successful:", response);
          resolve(response);
        } catch (error) {
          reject(new Error("Invalid response from server"));
        }
      } else {
        try {
          const error = JSON.parse(xhr.responseText);
          reject(new Error(error.error || "Upload failed"));
        } catch {
          reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
        }
      }
    });

    xhr.addEventListener("error", () => {
      reject(new Error("Network error during upload"));
    });

    xhr.addEventListener("abort", () => {
      reject(new Error("Upload cancelled"));
    });

    xhr.send(data); // <-- Send the complete FormData
  });
}

// Form Validation Helper
function validateForm(formId, customRules = {}) {
  const form = document.getElementById(formId);
  if (!form) return { isValid: false, errors: {} };

  const inputs = form.querySelectorAll(
    "input[required], textarea[required], select[required]"
  );
  let isValid = true;
  const errors = {};

  inputs.forEach((input) => {
    const value = input.value.trim();
    const fieldName = input.name || input.id;

    // Check required fields
    if (!value) {
      isValid = false;
      errors[fieldName] = "This field is required";
      highlightError(input, "This field is required");
    }
    // Check custom validation rules
    else if (customRules[fieldName]) {
      const rule = customRules[fieldName];

      if (rule.pattern && !rule.pattern.test(value)) {
        isValid = false;
        errors[fieldName] = rule.message || "Invalid format";
        highlightError(input, rule.message || "Invalid format");
      }

      if (rule.minLength && value.length < rule.minLength) {
        isValid = false;
        errors[fieldName] = `Must be at least ${rule.minLength} characters`;
        highlightError(input, `Must be at least ${rule.minLength} characters`);
      }

      if (rule.maxLength && value.length > rule.maxLength) {
        isValid = false;
        errors[fieldName] = `Cannot exceed ${rule.maxLength} characters`;
        highlightError(input, `Cannot exceed ${rule.maxLength} characters`);
      }

      if (rule.match) {
        const matchField = form.querySelector(`[name="${rule.match}"]`);
        if (matchField && value !== matchField.value.trim()) {
          isValid = false;
          errors[fieldName] = rule.message || "Fields do not match";
          highlightError(input, rule.message || "Fields do not match");
        }
      }
    }
    // Email validation
    else if (input.type === "email" && !isValidEmail(value)) {
      isValid = false;
      errors[fieldName] = "Please enter a valid email address";
      highlightError(input, "Please enter a valid email address");
    }
    // Password strength validation
    else if (input.type === "password" && value.length < 6) {
      isValid = false;
      errors[fieldName] = "Password must be at least 6 characters";
      highlightError(input, "Password must be at least 6 characters");
    }
    // Clear error if valid
    else {
      clearError(input);
    }
  });

  return { isValid, errors };
}

function highlightError(input, message) {
  input.style.borderColor = "var(--danger)";

  // Remove existing error message
  let errorMsg = input.nextElementSibling;
  if (errorMsg && errorMsg.classList.contains("error-message")) {
    errorMsg.remove();
  }

  // Add new error message
  errorMsg = document.createElement("div");
  errorMsg.className = "error-message";
  errorMsg.style.color = "var(--danger)";
  errorMsg.style.fontSize = "0.8rem";
  errorMsg.style.marginTop = "5px";
  errorMsg.textContent = message;

  input.parentNode.insertBefore(errorMsg, input.nextSibling);
}

function clearError(input) {
  input.style.borderColor = "";

  const errorMsg = input.nextElementSibling;
  if (errorMsg && errorMsg.classList.contains("error-message")) {
    errorMsg.remove();
  }
}

function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

// Local Storage Helpers
function saveToLocalStorage(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error("Error saving to localStorage:", error);
    showNotification(
      "Error saving data. Local storage might be full.",
      "error"
    );
    return false;
  }
}

function getFromLocalStorage(key, defaultValue = null) {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultValue;
  } catch (error) {
    console.error("Error reading from localStorage:", error);
    return defaultValue;
  }
}

function clearLocalStorage() {
  try {
    localStorage.clear();
    return true;
  } catch (error) {
    console.error("Error clearing localStorage:", error);
    return false;
  }
}

// Date/Time Helpers
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  } else {
    return `${minutes.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  }
}

function formatFileSize(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

// Debounce function for performance
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Throttle function for performance
function throttle(func, limit) {
  let inThrottle;
  return function () {
    const args = arguments;
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// Export functions for use in other files
window.PDFPracticePro = {
  // API
  makeRequest,
  uploadFile,

  // Auth
  getUserData,
  getAuthToken,
  isAuthenticated,
  requireAuth,
  handleLogout,

  // UI
  showNotification,
  validateForm,
  highlightError,
  clearError,

  // Utilities
  formatDate,
  formatTime,
  formatFileSize,
  saveToLocalStorage,
  getFromLocalStorage,
  clearLocalStorage,
  debounce,
  throttle,
};
