const express = require("express");
const cors = require("cors");
const path = require("path");
const uploadRoutes = require("./routes/uploadRoutes");

const app = express();
const port = 5000;

// Middleware to parse JSON and URL-encoded data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Use CORS middleware
app.use(cors({
  origin: 'http://localhost:5173', // Allow requests from this origin
  methods: ['GET', 'POST', 'PUT', 'DELETE'], // Allow these HTTP methods
  allowedHeaders: ['Content-Type', 'Authorization'] // Allow these headers
}));

// Serve static files from the uploads/Reports directory
app.use('/uploads/Reports', express.static(path.join(__dirname, 'uploads/Reports')));

// Use Upload Routes
app.use("/api/upload", uploadRoutes);

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
