import { Router } from "express";
import { auth } from "../middlewares/auth";
import { isAdmin } from "../middlewares/isAdmin";
import { 
  listUsers, 
  updateUserRole, 
  createUser, 
  updateUser, 
  deleteUser,
  setMyDepartment,
} from "../controllers/userController";

const router = Router();

router.use(auth);

router.post("/me/department", setMyDepartment);

router.get("/", listUsers);
router.post("/", isAdmin, createUser);
router.put("/:id", isAdmin, updateUser);
router.delete("/:id", isAdmin, deleteUser);
router.post("/:id/role", isAdmin, updateUserRole);

export default router;
