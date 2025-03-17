const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const { PDFDocument: PDFLibDocument } = require("pdf-lib");
const { convertPdfToImages } = require("../utils/pdfToImage");
const { runOcrAndSave } = require("../utils/ocrProcessor");
const globalData = require("../utils/globalData");
const nodemailer = require('nodemailer');
require("dotenv").config();



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

    let  ModuleName = " ";
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

        ModuleName = ocrResult.mockNumber;


        
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
    const totalEngScore = (globalData.english1?.score || 0) + (globalData.english2 ? globalData.english2.score : 0);
    const totalEngTotal = (globalData.english1?.totalScore || 0) + (globalData.english2 ? globalData.english2.totalScore : 0);
    const totalMathScore = (globalData.math1?.score || 0) + (globalData.math2 ? globalData.math2.score : 0);
    const totalMathTotal = (globalData.math1?.totalScore || 0) + (globalData.math2 ? globalData.math2.totalScore : 0);
    const totalSecuredScore = totalEngScore + totalMathScore;
    const totalPossibleScore = totalEngTotal + totalMathTotal;

    const calculatePercentage = (score, total) => total ? ((score / total) * 100).toFixed(2) + "%" : "N/A";

    const reportData = {
      name: globalData.math1?.name || globalData.english1?.name || "Null",
      email: globalData.math1?.email || globalData.english1?.email || "Null",
      dateSubmitted: globalData.math1?.dateSubmitted || globalData.english1?.dateSubmitted || "Null",
      scores: {
        English1: `${globalData.english1?.score + 100} [Scale of 100 - 400]`,
        English2: globalData.english2 ? `${globalData.english2?.score + 100} [Scale of 100 - 400]` : "N/A",
        TotalEnglish: `${totalEngScore + 200} [Scale of 200 - 800]`,
        Math1: `${globalData.math1?.score + 100} [Scale of 100 - 400]`,
        Math2: globalData.math2 ? `${globalData.math2?.score + 100} [Scale of 100 - 400]` : "N/A",
        TotalMath: `${totalMathScore + 200} [Scale of 200 - 800]`,
        Overall: `${totalSecuredScore + 400} [Scale of 400 - 1600]`,
      }
    };

    // Generate Final Report PDF
    const doc = new PDFDocument();
    const finalReportPath = `uploads/Reports/report_${Date.now()}.pdf`;
    const pdfStream = fs.createWriteStream(finalReportPath);
    doc.pipe(pdfStream);

    // Header
    doc.fontSize(18).font('Helvetica-Bold').text(`SAT SCORE  : ${ModuleName}`, { align: "center" }); //Module Name in Heading Goes Here
    doc.moveDown();
  
    // Student Details
    doc.fontSize(14).font('Helvetica-Bold').text("Student Details and Information");
    doc.moveDown();
    doc.fontSize(12).font('Helvetica').text(`Name: ${reportData.name}`);
    doc.text(`Email: ${reportData.email}`);
    doc.text(`Date Submitted: ${reportData.dateSubmitted}`);
    doc.moveDown();

    // English Report
    doc.fontSize(14).font('Helvetica-Bold').text("Raw Score - Digital Reading And Writing");
    doc.moveDown();
    doc.fontSize(12).font('Helvetica').text(`Digital Reading And Writing 1 : ${reportData.scores.English1}`);
    if (globalData.english2) {
      doc.text(`Digital Reading And Writing 2 : ${reportData.scores.English2}`);
    }
    doc.text(`Total Score - Digital Reading And Writing : ${reportData.scores.TotalEnglish}`);
    doc.moveDown();



    // Math Report
    doc.fontSize(14).font('Helvetica-Bold').text("Raw Score - Digital Maths");
    doc.moveDown();
    doc.fontSize(12).font('Helvetica').text(`Digital Maths 1 : ${reportData.scores.Math1}`);
    if (globalData.math2) {
      doc.text(`Digital Maths 2 : ${reportData.scores.Math2}`);
    }
    doc.text(`Total Score - Digital Math : ${reportData.scores.TotalMath}`);
    doc.moveDown();



    // Overall Performance With Adjusted Score
    doc.fontSize(16).font('Helvetica-Bold').text("Overall Score");
    doc.moveDown();
    doc.fontSize(13).font('Helvetica').text(`Overall Score : ${reportData.scores.Overall}`);
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
    
    const pdfUrl = `${req.protocol}://${req.get('host')}/uploads/Reports/${path.basename(mergedPdfPath)}`;

    // Send the email
    const emailSent = await sendReportEmail(pdfUrl, 'sreejesh@ebanitech.com');
     // Clear the globalData variable
     Object.keys(globalData).forEach(key => delete globalData[key]);


    // Send a 200 response with a link to the final merged PDF
    if (emailSent) {
      res.status(200).json({ message: 'Email sent successfully!', pdfUrl });
    } else {
      res.status(500).json({ error: 'Failed to send email' });
    }

  } catch (error) {
    console.error("❌ Error processing files:", error);
    res.status(500).json({ error: "Server error during OCR processing." });
  }
};


const sendReportEmail = async (url, recipientEmail) => {
  try {
    // Create a transporter using your SMTP configuration
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT), // Convert from string to number
      secure: true, // ✅ Set secure to true for port 465 (SSL)
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: {
        rejectUnauthorized: false, // ✅ Allows self-signed certificates if needed
      },
    });
    


    // Email options
    const mailOptions = {
      from: '"Uwezo Learning - SAT/GRE/GMAT Coaching in Hyderabad" <info@uwezolearning.us>',
      to: recipientEmail,
      cc: process.env.DEFAULT_CC,
      subject: 'Your Consolidated Score Card – Uwezo Learning',
      text: `Dear Student,

Greetings from Uwezo Learning!

We hope you are doing well. As part of our commitment to providing you with valuable insights into your progress, we are pleased to share your consolidated score card. This report reflects your performance across various sections, highlighting your strengths and areas for improvement.

You can access your score card using the following link:
${url}

We encourage you to review the report carefully and use the insights to refine your preparation strategy. Our team is always available to provide guidance and support to help you achieve your target scores.

Should you have any questions or require further clarification, please feel free to reach out to us.

Wishing you continued success in your test preparation!

Best Regards,  
Uwezo Learning Team  
SAT | GRE | GMAT Coaching  
Hyderabad  
Website: [www.uwezolearning.com](https://www.uwezolearning.com)  
Contact: +91-XXXXXXXXXX`,
      
      html: `
        <p>Dear Student,</p>

        <p>Greetings from <strong>Uwezo Learning!</strong></p>

        <p>We hope you are doing well. As part of our commitment to providing you with valuable insights into your progress, we are pleased to share your <strong>consolidated score card</strong>. This report reflects your performance across various sections, highlighting your strengths and areas for improvement.</p>

        <p><strong>You can access your score card using the link below:</strong></p>
        <p><a href="${url}" style="color: blue; font-size: 16px;">Click here to view your report</a></p>

        <p>We encourage you to review the report carefully and use the insights to refine your preparation strategy. Our team is always available to provide guidance and support to help you achieve your target scores.</p>

        <p>If you have any questions or need further clarification, please do not hesitate to contact us.</p>

        <p>Wishing you continued success in your test preparation!</p>

        <p><strong>Best Regards,</strong><br>
        <strong>Uwezo Learning Team</strong><br>
        SAT | GRE | GMAT Coaching<br>
        Hyderabad<br>
        <a href="https://www.uwezolearning.com">www.uwezolearning.com</a><br>
        Contact: +91-XXXXXXXXXX</p>
      `
    };

    // Send the email
    const mailsendst=await transporter.sendMail(mailOptions);
    console.log(mailsendst);
    console.log('Email sent successfully!');
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
}