📘 ExamForge – AI-Powered PDF to Online Test Platform

ExamForge is a full-stack web application that converts static PDF exam papers into interactive, timed online practice tests. It helps competitive exam aspirants practice efficiently by simulating real exam environments with automated question extraction, scoring, and performance analytics.

🚀 Project Overview

Many students preparing for exams like UPSC, SSC, JEE, Banking, NEET, etc., rely on PDF question papers. Practicing from PDFs is inefficient, time-consuming, and lacks real exam simulation.

ExamForge solves this problem by:
•Converting PDF question papers into interactive online tests
•Automatically extracting questions and options using AI-based processing
•Providing real-time timers, navigation, and result analysis
•Reducing manual preparation effort by up to 70–80%

✨ Key Features

•📄 PDF Upload & Processing – Upload any exam paper in PDF format
•🤖 AI-Based Question Extraction – Automatically detects questions and options
•✏️ Editable Review Stage – Quickly fix extraction errors before starting the test
•⏱️ Real Exam Simulation – Timers, navigation, and section-wise movement
•📊 Instant Results & Analytics – Score calculation, accuracy tracking, and performance insights
•🔐 User Authentication – Secure login and session-based access
•☁️ Cloud File Handling – Scalable and secure PDF storage

🛠️ Tech Stack
Frontend
 •HTML5
 •CSS3
 •JavaScript (Vanilla JS)

Backend
 •Node.js
 •Express.js

Database & Storage
 •MongoDB (via Mongoose)
 •Cloudinary (for PDF storage)

Utilities & Tools
 •PDF processing and text extraction
 •RESTful APIs
 •MVC-based project structure

📁 Project Structure

PDFPRACTICEPRO/
│
├── backend/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── utils/
│   ├── server.js
│   └── package.json
│
├── frontend/
│   ├── css/
│   ├── js/
│   ├── *.html
│
└── README.md


🧠 How It Works
•User uploads a PDF exam paper
•AI processes and extracts questions & options
•User reviews and edits extracted content
•Test is generated with timer and navigation
•Results and analytics are displayed after submission