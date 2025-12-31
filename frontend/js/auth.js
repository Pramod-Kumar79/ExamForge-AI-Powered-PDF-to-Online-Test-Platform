// js/auth.js - Authentication functions
document.addEventListener("DOMContentLoaded", function () {
  // Check authentication on page load
  checkPageAuth();
});

// Check if page requires authentication
function checkPageAuth() {
  const protectedPages = [
    "dashboard.html",
    "upload.html",
    "review.html",
    "test.html",
    "results.html",
    "profile.html",
    "settings.html",
  ];

  const currentPage = window.location.pathname.split("/").pop();

  if (protectedPages.includes(currentPage)) {
    if (!PDFPracticePro.isAuthenticated()) {
      PDFPracticePro.showNotification(
        "Please login to access this page",
        "warning"
      );
      setTimeout(() => {
        window.location.href = `index.html?redirect=${encodeURIComponent(
          window.location.pathname
        )}`;
      }, 1500);
    }
  }
}

// Register function
async function registerUser(userData) {
  try {
    const response = await PDFPracticePro.makeRequest(
      "/auth/register",
      "POST",
      userData
    );

    if (response && response.success) {
      // Save token and user data
      localStorage.setItem("auth_token", response.token);
      localStorage.setItem("user_data", JSON.stringify(response.user));

      return response;
    }
  } catch (error) {
    throw error;
  }
}

// Login function
async function loginUser(credentials) {
  try {
    const response = await PDFPracticePro.makeRequest(
      "/auth/login",
      "POST",
      credentials
    );

    if (response && response.success) {
      // Save token and user data
      localStorage.setItem("auth_token", response.token);
      localStorage.setItem("user_data", JSON.stringify(response.user));

      return response;
    }
  } catch (error) {
    throw error;
  }
}

// Get current user
async function getCurrentUser() {
  try {
    const response = await PDFPracticePro.makeRequest("/auth/me");
    return response;
  } catch (error) {
    throw error;
  }
}

// Update user profile
async function updateUserProfile(userData) {
  try {
    const response = await PDFPracticePro.makeRequest(
      "/auth/profile",
      "PUT",
      userData
    );
    return response;
  } catch (error) {
    throw error;
  }
}

// Change password
async function changePassword(currentPassword, newPassword) {
  try {
    const response = await PDFPracticePro.makeRequest(
      "/auth/change-password",
      "PUT",
      {
        currentPassword,
        newPassword,
      }
    );
    return response;
  } catch (error) {
    throw error;
  }
}

// Forgot password
async function forgotPassword(email) {
  try {
    const response = await PDFPracticePro.makeRequest(
      "/auth/forgot-password",
      "POST",
      { email }
    );
    return response;
  } catch (error) {
    throw error;
  }
}

// Reset password
async function resetPassword(token, newPassword) {
  try {
    const response = await PDFPracticePro.makeRequest(
      "/auth/reset-password",
      "POST",
      {
        token,
        newPassword,
      }
    );
    return response;
  } catch (error) {
    throw error;
  }
}

// Export functions
window.Auth = {
  registerUser,
  loginUser,
  getCurrentUser,
  updateUserProfile,
  changePassword,
  forgotPassword,
  resetPassword,
};
