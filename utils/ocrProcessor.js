const Tesseract = require("tesseract.js");
const fs = require("fs");
const path = require("path");

exports.runOcrAndSave = async (imagePaths, fileType) => {
  if (!imagePaths.length) {
    console.error(`❌ No images found for ${fileType}`);
    return { score: 0, totalScore: 0, page3Text: "" };
  }

  let extractedData = { 
    score: 0, 
    totalScore: 0, 
    page3Text: "", 
    name: "Unknown", 
    email: "Unknown", 
    dateSubmitted: "Unknown", 
    moduleFinal: "Unknown",
    mockNumber: "Unknown"
  };

  // **First Page Processing**
  const firstImagePath = path.resolve(imagePaths[0]);
  console.log(`📄 Running OCR on first page of ${fileType}: ${firstImagePath}`);

  if (fs.existsSync(firstImagePath)) {
    try {
      const { data: { text } } = await Tesseract.recognize(firstImagePath, "eng");

      // **Extract relevant section before "Analysis Based on Difficulty"**
      const extractedText = text.split("Analysis Based on Difficulty")[0]?.trim();
      console.log(`📄 Extracted raw text from first page of ${fileType}:\n${extractedText}`);

      // **Extract Module & Mock Number**
      const moduleRegex = /Module\s*:\s*(\d+)\s*-\s*\(Mock\s*-\s*(\d+)\)/;
      const moduleMatch = extractedText.match(moduleRegex);
      if (moduleMatch) {
        extractedData.moduleFinal = moduleMatch[1]; // Module Number
        extractedData.mockNumber = moduleMatch[2]; // Mock Test Number
        console.log(`📚 Extracted Module: ${extractedData.moduleFinal}`);
        console.log(`🔢 Extracted Mock Number: ${extractedData.mockNumber}`);
      }

      // **Extract Date Submitted**
      const dateMatch = extractedText.match(/Date Submitted\s*:\s*(.*)/);
      extractedData.dateSubmitted = dateMatch ? dateMatch[1].trim() : "Unknown";
      console.log(`📅 Extracted Date Submitted: ${extractedData.dateSubmitted}`);

      // **Extract Username**
      const nameMatch = extractedText.match(/Username\s*:\s*(.*)/);
      extractedData.name = nameMatch ? nameMatch[1].trim() : "Unknown";
      console.log(`👤 Extracted Name: ${extractedData.name}`);

      // **Extract Email**
      const emailMatch = extractedText.match(/Email\s*:\s*([\w.-]+@[\w.-]+\.\w+)/);
      extractedData.email = emailMatch ? emailMatch[1].trim() : "Unknown";
      console.log(`📧 Extracted Email: ${extractedData.email}`);

      // **Extract Score from "Score : 238 [Scale of 100 - 400]"**
      const scoreRegex = /Score\s*:\s*(\d+)\s*\[\d+ - \d+\]/;
      const scoreMatch = extractedText.match(scoreRegex);
      extractedData.score = scoreMatch ? parseInt(scoreMatch[1]) : 0;
      extractedData.totalScore = 400; // Since the max scale is 400

      console.log(scoreMatch);
      console.log(`📊 Score Extraction:`);
      console.log(`✔ Score: ${extractedData.score}`);
      console.log(`✔ Total Score: ${extractedData.totalScore}`);

    } catch (error) {
      console.error(`❌ Error processing first page OCR for ${fileType}:`, error);
    }
  } else {
    console.error(`❌ First page image not found for ${fileType}: ${firstImagePath}`);
  }

  return extractedData;
};
