const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const http = require("http");
const socketIO = require("socket.io");
const path = require("path");
require("dotenv").config();

// Import routes
const authRoutes = require("./routes/auth");
const uploadRoutes = require("./routes/upload");
const questionRoutes = require("./routes/questions");
const testRoutes = require("./routes/test");
const resultRoutes = require("./routes/results");

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "http://localhost:3001",
    methods: ["GET", "POST"],
  },
});

// Middleware
app.use(
  cors({
    origin: "http://localhost:3001",
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from frontend
app.use(express.static(path.join(__dirname, "../frontend")));

// Database connection
mongoose
  .connect(
    process.env.MONGODB_URI || "mongodb://localhost:27017/pdf-practice-pro",
    {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }
  )
  .then(() => console.log("✅ MongoDB connected successfully"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// Socket.IO for real-time updates
io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);
  socket.on("join-room", (roomId) => {
    socket.join(roomId);
    console.log(`Socket ${socket.id} joined room ${roomId}`);
  });
  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

// Make io accessible to routes
app.set("socketio", io);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/questions", questionRoutes);
app.use("/api/test", testRoutes);
app.use("/api/results", resultRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    service: "PDF Practice Pro API",
  });
});

// Test route
app.get("/api/test", (req, res) => {
  res.json({
    success: true,
    message: "API is working!",
    timestamp: new Date().toISOString(),
  });
});

// Serve HTML pages
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/dashboard.html"));
});

app.get("/upload", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/upload.html"));
});

app.get("/review", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/review.html"));
}); 

app.get("/test", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/test.html"));
});

app.get("/results", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/results.html"));
});
app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/login.html'));
});
app.get("/register", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/register.html"));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Error:", err.stack);
  res.status(err.status || 500).json({
    error: {
      message: err.message || "Internal server error",
      ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    },
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 API URL: http://localhost:${PORT}/api`);
  console.log(`🌐 Frontend: http://localhost:${PORT}`);
});
