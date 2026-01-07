"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractTextFromFile = extractTextFromFile;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const pdf_parse_1 = __importDefault(require("pdf-parse"));
const mammoth_1 = __importDefault(require("mammoth"));
async function extractTextFromFile(filePath) {
    const ext = path_1.default.extname(filePath).toLowerCase();
    // ensure file exists
    if (!fs_1.default.existsSync(filePath))
        return null;
    try {
        if (ext === ".pdf") {
            const data = await fs_1.default.promises.readFile(filePath);
            const res = await (0, pdf_parse_1.default)(data);
            return res.text || "";
        }
        if (ext === ".docx") {
            const res = await mammoth_1.default.extractRawText({ path: filePath });
            return res.value || "";
        }
        // fallback: read as utf-8 text
        const txt = await fs_1.default.promises.readFile(filePath, "utf8");
        return txt;
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.warn("Failed to extract text", err?.message || err);
        return null;
    }
}
exports.default = { extractTextFromFile };
