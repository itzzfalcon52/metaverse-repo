import express from "express";
import cors from "cors";
import v1Router from "./routes/v1/index.js";
import cookieParser from "cookie-parser";

const app = express();



app.use(cookieParser());

app.use(cors({
  origin: "http://localhost:3002",   // frontend origin
  credentials: true                  // allow cookies
}));

app.use(express.json());

app.get("/", (req, res) => {
  res.send("Backend running");
});

app.use("/api/v1", v1Router);

export default app;
