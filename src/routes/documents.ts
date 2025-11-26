import { Router } from "express";
import { auth } from "../middlewares/auth";
import { upload } from "../services/fileService";
import {
  createDocument,
  listDocuments,
  getDocument,
  uploadVersion,
  addComment,
  requestApproval,
} from "../controllers/documentController";

const router = Router();

router.use(auth);

router.post("/", upload.single("file"), createDocument);
router.get("/", listDocuments);
router.get("/:id", getDocument);
router.post("/:id/version", upload.single("file"), uploadVersion);
router.post("/:id/comment", addComment);
router.post("/:id/request-approval", requestApproval);

export default router;
