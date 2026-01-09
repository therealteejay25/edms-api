import fs from "fs";
import path from "path";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";

export async function extractTextFromFile(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  // ensure file exists
  if (!fs.existsSync(filePath)) return null;
  try {
    if (ext === ".pdf") {
      const data = await fs.promises.readFile(filePath);
      const res = await pdfParse(data);
      return res.text || "";
    }
    if (ext === ".docx") {
      const res = await mammoth.extractRawText({ path: filePath });
      return res.value || "";
    }
    // fallback: read as utf-8 text
    const txt = await fs.promises.readFile(filePath, "utf8");
    return txt;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("Failed to extract text", (err as any)?.message || err);
    return null;
  }
}

export default { extractTextFromFile };
