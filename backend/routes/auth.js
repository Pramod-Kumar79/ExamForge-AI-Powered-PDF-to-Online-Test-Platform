const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const UserProgress = require("../models/UserProgress");
const { protect } = require("../middleware/auth");

// Register new user
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, examTypes } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "User already exists" });
    }

    // Create user
    const user = await User.create({
      name,
      email,
      password,
      examTypes: examTypes || [],
    });

    // Create user progress tracker
    await UserProgress.create({ userId: user._id });

    // Generate token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN,
    });

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        examTypes: user.examTypes,
        subscription: user.subscription,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: "Server error during registration" });
  }
});

// Login user
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Update last active
    user.lastActive = Date.now();
    await user.save();

    // Generate token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN,
    });

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        examTypes: user.examTypes,
        subscription: user.subscription,
        pdfsUploaded: user.pdfsUploaded,
        pdfLimit: user.pdfLimit,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Server error during login" });
  }
});

// Get current user
router.get("/me", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const progress = await UserProgress.findOne({ userId: req.user.id });

    res.json({
      success: true,
      user,
      progress: progress || {},
    });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Update user profile
router.put("/profile", protect, async (req, res) => {
  try {
    const { name, examTypes } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { name, examTypes, updatedAt: Date.now() },
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Change password
router.put("/change-password", protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user.id).select("+password");

    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: "Password updated successfully",
    });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
