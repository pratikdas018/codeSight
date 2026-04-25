import { Router } from "express";
import { getHistory, saveHistory } from "../controllers/historyController";
import { authenticate } from "../services/authMiddleware";

const historyRoutes = Router();

historyRoutes.post("/save-history", authenticate, saveHistory);
historyRoutes.get("/history", authenticate, getHistory);

export default historyRoutes;
