const express = require("express");
const { handleFileUpload,login,verifyLogin } = require("../controllers/uploadController");
const upload = require("../middleware/uploadMiddleware");

const router = express.Router();

router.post("/", upload, handleFileUpload);
router.post("/login", login);
router.post("/verify", verifyLogin);



module.exports = router;
