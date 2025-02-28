const express = require("express");
const { handleFileUpload } = require("../controllers/uploadController");
const upload = require("../middleware/uploadMiddleware");

const router = express.Router();

router.post("/", upload, handleFileUpload);

module.exports = router;
