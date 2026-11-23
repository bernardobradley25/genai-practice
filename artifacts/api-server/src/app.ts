import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.disable("x-powered-by");
app.use(cors({ origin: ["https://reflow-training-coach.replit.app", "http://127.0.0.1:20368", "http://localhost:20368"] }));
app.use(express.json({ limit: "96kb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
