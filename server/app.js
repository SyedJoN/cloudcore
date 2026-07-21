import express from "express";
import helmet from "helmet";
import cors from "cors";

import readFileRoutes from "./routes/readFileRoutes.js";
import writeFileRoutes from "./routes/writeFileRoutes.js";
import readDirRoutes from "./routes/readDirRoutes.js";
import writeDirRoutes from "./routes/writeDirRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import subscriptionRoutes from "./routes/subscriptionRoutes.js";
import cookieParser from "cookie-parser";

import { checkAuth } from "./middlewares/authMiddleware.js";
import { connectDB } from "./config/db.js";
import { validateDeletedUser } from "./middlewares/validateUserMiddleware.js";
import { optionalAuth } from "./middlewares/optionalAuthMiddleware.js";
import { config } from "./config/config.js";
import { LIMITERS } from "./config/limiters.js";

import {
  getSharedWithMe,
  getTrashItems,
} from "./controllers/directory.controller.js";
import { createSubscription } from "./controllers/subscriptionController.js";
import { startSubscriptionCron } from "./cron/subscription.cron.js";

await connectDB();

const app = express();
const PORT = config.port || 4000;
app.use(
  cors({
    origin: config.clientURL,
    credentials: true,
  }),
);
app.use(
  helmet({
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        "frame-ancestors": ["'self'", "http://localhost:5173"],
      },
    },
  }),
);

app.use(cookieParser(process.env.SESSION_SECRET));

export const rateLimitMiddleware = (limiter, getKey) => {
  return async (req, res, next) => {
    try {
      const key = getKey ? getKey(req) : req.user?._id || req.ip;

      await limiter.consume(key);
      next();
    } catch (err) {
      res.status(429).json({
        error: "Too many requests",
      });
    }
  };
};

app.use((req, res, next) => {
  if (
    req.method === "POST" &&
    (
      /^\/file\/[^/]+$/.test(req.path) ||
      req.originalUrl === "/subscription/stripe/events"
    )
  ) {
    return next();
  }

  express.json()(req, res, next);
});

app.use(
  "/file",
  // rateLimitMiddleware(LIMITERS.readFileOps),
  optionalAuth,
  readFileRoutes,
);
app.use(
  "/file",
  // rateLimitMiddleware(LIMITERS.writeFileOps),
  optionalAuth,
  writeFileRoutes,
);

app.use(
  "/directory",
  // rateLimitMiddleware(LIMITERS.readDirOps),
  checkAuth,
  validateDeletedUser,
  readDirRoutes,
);
app.use(
  "/directory",
  // rateLimitMiddleware(LIMITERS.writeDirOps),
  checkAuth,
  validateDeletedUser,
  writeDirRoutes,
);

app.use("/subscription", subscriptionRoutes);
app.use("/user", checkAuth, validateDeletedUser, userRoutes);
app.use("/auth", /*rateLimitMiddleware(LIMITERS.auth)*/ authRoutes);
app.get("/shared", checkAuth, getSharedWithMe);
app.get("/trash/{:id}", checkAuth, getTrashItems);


app.use((err, req, res, next) => {
  console.log(err);
  res.status(err.status || 500).json({ error: "Something went wrong" });
});
startSubscriptionCron();
app.listen(PORT, () => {
  console.log(`Server Started on PORT ${PORT}`);
});
