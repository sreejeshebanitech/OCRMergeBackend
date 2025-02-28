const multer = require("multer");
const fs = require("fs");

// Ensure uploads directory exists
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ storage }).fields([
  { name: "math1", maxCount: 1 },
  { name: "math2", maxCount: 1 },
  { name: "english1", maxCount: 1 },
  { name: "english2", maxCount: 1 },
]);

module.exports = upload;
