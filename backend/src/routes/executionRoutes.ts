import { Router } from "express";
import { execute } from "../controllers/executionController";

const executionRoutes = Router();

executionRoutes.post("/execute", execute);

export default executionRoutes;
