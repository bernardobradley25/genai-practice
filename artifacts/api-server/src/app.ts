import express, { type Express, type ErrorRequestHandler } from "express";
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

const inputError: ErrorRequestHandler = (error, _req, res, next) => {
  if (res.headersSent) return next(error);
  const status = error?.type === 'entity.too.large' ? 413 : error?.type === 'entity.parse.failed' ? 400 : 500;
  res.status(status).json({ error: status === 413 ? 'The request is too large. Shorten your message or start a new chat.' : status === 400 ? 'The request could not be read. Send valid JSON.' : 'The service encountered an error. Your week is unchanged.' });
};
app.use(inputError);
export default app;
