const Tesseract = require("tesseract.js");
const fs = require("fs");
const path = require("path");

exports.runOcrAndSave = async (imagePaths, fileType) => {
  if (!imagePaths.length) {
    console.error(`No images found for ${fileType}`);
    return { score: 0, totalScore: 0, page3Text: "" };
  }

  let extractedData = { score: 0, totalScore: 0, page3Text: "" };

  // Process **first page** (OCR until "Analysis Based on Difficulty")
  const firstImagePath = path.resolve(imagePaths[0]); // First page
  console.log(`📄 Running OCR on first page of ${fileType}: ${firstImagePath}`);

  if (fs.existsSync(firstImagePath)) {
    try {
      const { data: { text } } = await Tesseract.recognize(firstImagePath, "eng");

      // Extract until "Analysis Based on Difficulty"
      const extractedText = text.split("Analysis Based on Difficulty")[0]?.trim();

      // Log the extracted text for debugging
      console.log(`📄 Extracted text from first page of ${fileType}:`);
      console.log(extractedText);

      // Extract Name, Email, Date only from Math1
      if (fileType === "math1") {
        const moduleMatch = text.match(/Module:\s*(.*)/);
        const nameMatch = extractedText.match(/Username:\s*(.*)/);
        const emailMatch = extractedText.match(/Email:\s*(.*)/);
        const dateMatch = extractedText.match(/Date Submitted:\s*(.*)/);

        extractedData.name = nameMatch ? nameMatch[1].trim() : "Unknown";
        extractedData.email = emailMatch ? emailMatch[1].trim() : "Unknown";
        extractedData.dateSubmitted = dateMatch ? dateMatch[1].trim() : "Unknown";
      }

      // Extract Score & Total Score
      // Modified regex to handle different score formats
      const scoreMatch = extractedText.match(/Score:\s*(\d+)(?:\/| of )(\d+)/);
      extractedData.score = scoreMatch ? parseInt(scoreMatch[1]) : 0;
      extractedData.totalScore = scoreMatch ? parseInt(scoreMatch[2]) : 0;

      // Log the score match result for debugging
      console.log(`📊 Score match result for ${fileType}:`, scoreMatch);
      console.log(`📊 Extracted score for ${fileType}: ${extractedData.score}/${extractedData.totalScore}`);

      const moduleMatch = text.match(/Module:\s*(.*)/);
      const mockNumberMatch = moduleMatch ? moduleMatch[1].match(/\(([^)]+)\)/) : null;
      extractedData.mockNumber = mockNumberMatch ? mockNumberMatch[1] : "Unknown";

    } catch (error) {
      console.error(`❌ Error processing first page OCR for ${fileType}:`, error);
    }
  } else {
    console.error(`❌ First page image not found for ${fileType}: ${firstImagePath}`);
  }

  // Process **third page** (Full OCR)


  return extractedData;
};