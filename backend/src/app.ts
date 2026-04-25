import cors from "cors";
import express from "express";
import authRoutes from "./routes/authRoutes";
import codeRoutes from "./routes/codeRoutes";
import executionRoutes from "./routes/executionRoutes";
import historyRoutes from "./routes/historyRoutes";

const app = express();

const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(",").map((origin) => origin.trim())
  : true;

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
);
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_request, response) => {
  response.json({ status: "ok" });
});

app.use(authRoutes);
app.use(executionRoutes);
app.use(codeRoutes);
app.use(historyRoutes);

app.use((_request, response) => {
  response.status(404).json({ message: "Route not found." });
});

export default app;
