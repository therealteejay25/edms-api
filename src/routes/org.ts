import { Router } from "express";
import { auth } from "../middlewares/auth";
import { requireOrgAdmin } from "../middlewares/roles";
import {
  getOrg,
  updateOrg,
  listDepartments,
  addDepartment,
  removeDepartment,
} from "../controllers/orgController";

const router = Router();

router.use(auth);

router.get("/", getOrg);
router.post("/", requireOrgAdmin, updateOrg);

router.get("/departments", listDepartments);
router.post("/departments", requireOrgAdmin, addDepartment);
router.delete("/departments/:name", requireOrgAdmin, removeDepartment);

export default router;
