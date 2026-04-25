import { Router } from "express";
import {
  getCodeById,
  getCodes,
  saveCode,
} from "../controllers/codeController";
import { authenticate } from "../services/authMiddleware";

const codeRoutes = Router();

codeRoutes.post("/save-code", authenticate, saveCode);
codeRoutes.get("/get-codes", authenticate, getCodes);
codeRoutes.get("/code/:id", authenticate, getCodeById);

export default codeRoutes;
