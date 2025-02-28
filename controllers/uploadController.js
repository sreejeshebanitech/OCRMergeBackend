const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const { PDFDocument: PDFLibDocument } = require("pdf-lib");
const { convertPdfToImages } = require("../utils/pdfToImage");
const { runOcrAndSave } = require("../utils/ocrProcessor");
const globalData = require("../utils/globalData");

const deleteFolderContents = (folderPath) => {
  fs.readdir(folderPath, (err, files) => {
    if (err) throw err;
    for (const file of files) {
      const filePath = path.join(folderPath, file);
      fs.stat(filePath, (err, stat) => {
        if (err) throw err;
        if (stat.isFile()) {
          fs.unlink(filePath, err => {
            if (err) throw err;
          });
        } else if (stat.isDirectory()) {
          deleteFolderContents(filePath);
          fs.rmdir(filePath, err => {
            if (err) throw err;
          });
        }
      });
    }
  });
};

exports.handleFileUpload = async (req, res) => {
  try {
    const files = req.files;
    if (!files.math1 || !files.english1) {
      return res.status(400).json({ error: "Math1 and English1 files are required." });
    }

    console.log("\n🔹 Processing OCR for Uploaded PDFs...");

    const filePaths = {
      math1: files.math1?.[0]?.path,
      math2: files.math2?.[0]?.path,
      english1: files.english1?.[0]?.path,
      english2: files.english2?.[0]?.path
    };

    if(!files.math1)
    {
      console.error(`�� Math1 file is required.`);
      
    }
    for (const [key, filePath] of Object.entries(filePaths)) {
      if (!filePath) continue;

      console.log(`📄 Processing ${key.toUpperCase()}: ${filePath}`);
      
      // Convert PDF to Images

      
      const imagePaths = await convertPdfToImages(filePath);
      if (!imagePaths[0]) {
        console.error(`⚠️ No first-page image found for ${key}. Skipping OCR.`);
        continue;
      }

      // Run OCR on first page only (No duplicates)
      console.log(`📄 Running OCR on first page of ${key}: ${imagePaths[0]}`);
      try {
        const ocrResult = await runOcrAndSave([imagePaths[0]], key); // Only first page

        // Store extracted data
       // Store extracted data
          globalData[key] = {
            name: ocrResult.name || "Null",
            email: ocrResult.email || "Null",
            dateSubmitted: ocrResult.dateSubmitted || "Null",
            score: ocrResult.score || 0,
            totalScore: ocrResult.totalScore || 0
          };
      } catch (error) {
        console.error(`❌ OCR failed for ${key}:`, error);
      }
    }

    console.log("✅ OCR Processing Completed. Generating PDF...");

    // Compute Total Scores & Percentages
    // Compute Total Scores & Percentages
        const totalEngScore = (globalData.english1?.score || 0) + (globalData.english2?.score || 0);
        const totalEngTotal = (globalData.english1?.totalScore || 0) + (globalData.english2?.totalScore || 0);
        const totalMathScore = (globalData.math1?.score || 0) + (globalData.math2?.score || 0);
        const totalMathTotal = (globalData.math1?.totalScore || 0) + (globalData.math2?.totalScore || 0);
        const totalSecuredScore = totalEngScore + totalMathScore;
        const totalPossibleScore = totalEngTotal + totalMathTotal;

    const calculatePercentage = (score, total) => total ? ((score / total) * 100).toFixed(2) + "%" : "N/A";

    const reportData = {
      name: globalData.math1?.name || globalData.english1?.name || "Null",
      email: globalData.math1?.email || globalData.english1?.email || "Null",
      dateSubmitted: globalData.math1?.dateSubmitted || globalData.english1?.dateSubmitted || "Null",
      scores: {
        English1: `${globalData.english1?.score}/${globalData.english1?.totalScore} (${calculatePercentage(globalData.english1?.score, globalData.english1?.totalScore)})`,
        English2: `${globalData.english2?.score}/${globalData.english2?.totalScore} (${calculatePercentage(globalData.english2?.score, globalData.english2?.totalScore)})`,
        TotalEnglish: `${totalEngScore}/${totalEngTotal} (${calculatePercentage(totalEngScore, totalEngTotal)})`,
        Math1: `${globalData.math1?.score}/${globalData.math1?.totalScore} (${calculatePercentage(globalData.math1?.score, globalData.math1?.totalScore)})`,
        Math2: `${globalData.math2?.score}/${globalData.math2?.totalScore} (${calculatePercentage(globalData.math2?.score, globalData.math2?.totalScore)})`,
        TotalMath: `${totalMathScore}/${totalMathTotal} (${calculatePercentage(totalMathScore, totalMathTotal)})`,
        Overall: `${totalSecuredScore}/${totalPossibleScore} (${calculatePercentage(totalSecuredScore, totalPossibleScore)})`
      }
    };

    // Generate Final Report PDF
    const doc = new PDFDocument();
    const finalReportPath = `uploads/Reports/report_${Date.now()}.pdf`;
    const pdfStream = fs.createWriteStream(finalReportPath);
    doc.pipe(pdfStream);

    // Header
    doc.fontSize(18).font('Helvetica-Bold').text("Student Final Report", { align: "center" });
    doc.moveDown();
  
    // Student Details
    doc.fontSize(14).font('Helvetica-Bold').text("Student Details and Information");
    doc.moveDown();
    doc.fontSize(12).font('Helvetica').text(`Name: ${reportData.name}`);
    doc.text(`Email: ${reportData.email}`);
    doc.text(`Date Submitted: ${reportData.dateSubmitted}`);
    doc.moveDown();

    // English Report
    doc.fontSize(14).font('Helvetica-Bold').text("English Report");
    doc.moveDown();
    doc.fontSize(12).font('Helvetica').text(`English 1: ${reportData.scores.English1}`);
    doc.text(`English 2: ${reportData.scores.English2}`);
    doc.text(`Total English: ${reportData.scores.TotalEnglish}`);
    doc.moveDown();

    // Math Report
    doc.fontSize(14).font('Helvetica-Bold').text("Math Report");
    doc.moveDown();
    doc.fontSize(12).font('Helvetica').text(`Math 1: ${reportData.scores.Math1}`);
    doc.text(`Math 2: ${reportData.scores.Math2}`);
    doc.text(`Total Math: ${reportData.scores.TotalMath}`);
    doc.moveDown();

    // Overall Performance
    doc.fontSize(16).font('Helvetica-Bold').text("Overall Performance");
    doc.moveDown();
    doc.fontSize(13).font('Helvetica').text(`Overall: ${reportData.scores.Overall}`);
    doc.moveDown();

    doc.end();

    // Wait for the PDF to be written
    await new Promise(resolve => pdfStream.on("finish", resolve));

    // Merge PDFs using pdf-lib
    const mergedPdf = await PDFLibDocument.create();

    const addPdfToMerged = async (pdfPath) => {
      const pdfBytes = fs.readFileSync(pdfPath);
      const pdf = await PDFLibDocument.load(pdfBytes);
      const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      copiedPages.forEach((page) => mergedPdf.addPage(page));
    };

    // Add the OCR-generated report first
    await addPdfToMerged(finalReportPath);

    // Add the English 1, English 2, Math 1, and Math 2 PDFs in order
    if (filePaths.english1) await addPdfToMerged(filePaths.english1);
    if (filePaths.english2) await addPdfToMerged(filePaths.english2);
    if (filePaths.math1) await addPdfToMerged(filePaths.math1);
    if (filePaths.math2) await addPdfToMerged(filePaths.math2);

    const mergedPdfBytes = await mergedPdf.save();
    const mergedPdfPath = `uploads/Reports/merged_report_${Date.now()}.pdf`;
    fs.writeFileSync(mergedPdfPath, mergedPdfBytes);
    
    // Delete all other content in the uploads folder except the Reports directory
    const uploadsDir = path.join(__dirname, '../uploads');
    fs.readdir(uploadsDir, (err, files) => {
      if (err) throw err;
      for (const file of files) {
        const filePath = path.join(uploadsDir, file);
        if (file !== 'Reports') {
          fs.stat(filePath, (err, stat) => {
            if (err) throw err;
            if (stat.isFile()) {
              fs.unlink(filePath, err => {
                if (err) throw err;
              });
            } else if (stat.isDirectory()) {
              deleteFolderContents(filePath);
              fs.rmdir(filePath, err => {
                if (err) throw err;
              });
            }
          });
        }
      }
    });
    
    // Send a 200 response with a link to the final merged PDF
    const pdfUrl = `${req.protocol}://${req.get('host')}/uploads/Reports/${path.basename(mergedPdfPath)}`;
    res.status(200).json({ message: "PDF generated successfully", pdfUrl });

   

  } catch (error) {
    console.error("❌ Error processing files:", error);
    res.status(500).json({ error: "Server error during OCR processing." });
  }
};