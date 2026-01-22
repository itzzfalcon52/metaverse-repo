import express from "express";
import cors from "cors";
import v1Router from "./routes/v1/index.js";
import cookieParser from "cookie-parser";

const app = express();



app.use(cookieParser());

const allowedOrigins = [
  "http://localhost:3002",
  "https://metaverse-repo-web-xqc5.vercel.app"
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true
}));

app.use(express.json());

app.get("/", (req, res) => {
  res.send("Backend running");
});

app.use("/api/v1", v1Router);

export default app;
