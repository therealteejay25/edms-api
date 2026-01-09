"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.upload = exports.storage = void 0;
exports.moveFile = moveFile;
const path_1 = __importDefault(require("path"));
const promises_1 = __importDefault(require("fs/promises"));
const multer_1 = __importDefault(require("multer"));
function ensureDir(dir) {
    return promises_1.default.mkdir(dir, { recursive: true }).catch(() => { });
}
exports.storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        // Prefer org in body, fallback to req.user.org if available
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const org = req.body.org || (req.user && req.user.org) || "public";
        const department = req.body.department || "general";
        const type = req.body.type || "misc";
        const dest = path_1.default.join(process.cwd(), "uploads", String(org), department, type);
        ensureDir(dest)
            .then(() => cb(null, dest))
            .catch((e) => cb(e, dest));
    },
    filename: (_req, file, cb) => {
        const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}-${file.originalname}`;
        cb(null, unique);
    },
});
exports.upload = (0, multer_1.default)({ storage: exports.storage });
async function moveFile(currentPath, destDir) {
    await ensureDir(destDir);
    const fileName = path_1.default.basename(currentPath);
    const newPath = path_1.default.join(destDir, fileName);
    await promises_1.default.rename(currentPath, newPath);
    return newPath;
}
