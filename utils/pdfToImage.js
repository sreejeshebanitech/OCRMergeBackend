const poppler = require("pdf-poppler");
const path = require("path");
const fs = require("fs");

exports.convertPdfToImages = async (pdfPath) => {
  const outputImagePath = pdfPath.replace(".pdf", "");
  const opts = {
    format: "png",
    out_dir: path.dirname(pdfPath),
    out_prefix: path.basename(outputImagePath),
  };

  try {
    await poppler.convert(pdfPath, opts);
    return fs.readdirSync(path.dirname(pdfPath))
      .filter(file => file.startsWith(path.basename(outputImagePath)))
      .map(file => path.join(path.dirname(pdfPath), file));
  } catch (err) {
    console.error("Error converting PDF to images:", err);
    return [];
  }
};
