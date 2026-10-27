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
import { RateLimiterRes } from "rate-limiter-flexible";

import {
  getSharedWithMe,
  getStarredItems,
  getTrashItems,
  sendLink,
  toggleItemStar,
  sendOwnershipMail,
  cancelOwnershipMail,
  ownershipAction,
  copyItem,
  moveItem,
} from "./controllers/directory.controller.js";
import { startSubscriptionCron } from "./cron/subscription.cron.js";
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
        "frame-ancestors": ["'self'", process.env.CLIENT_URL],
      },
    },
  }),
);

app.use(cookieParser(process.env.SESSION_SECRET));

const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export const rateLimitMiddleware = (limiter, getKey) => {
  return async (req, res, next) => {
    const key = getKey ? getKey(req) : req.user?._id?.toString() || req.ip;

    try {
      await limiter.consume(key);
      return next();
    } catch (err) {
      // Real rate-limit rejection
      if (err instanceof RateLimiterRes) {
        res.set("Retry-After", Math.ceil(err.msBeforeNext / 1000));
        return res.status(429).json({ error: "Too many requests" });
      }

      // Store failure (Redis/Mongo down or slow): log it and fail open
      console.error("Rate limiter error:", err);
      return next();
    }
  };
};
// Picks ONE limiter per request based on HTTP method
export const rateLimitByMethod = (readLimiter, writeLimiter) => {
  const read = rateLimitMiddleware(readLimiter);
  const write = rateLimitMiddleware(writeLimiter);
  return (req, res, next) =>
    (READ_METHODS.has(req.method) ? read : write)(req, res, next);
};
app.use((req, res, next) => {
  if (
    req.method === "POST" &&
    (/^\/file\/[^/]+$/.test(req.path) ||
      req.originalUrl === "/subscription/stripe/events")
  ) {
    return next();
  }

  express.json()(req, res, next);
});

app.get("/healthz", (req, res) => {
  return res.status(200).json({ message: "SERVING" });
});

app.use(
  "/file",
  // rateLimitByMethod(LIMITERS.readFileOps, LIMITERS.writeFileOps),
  optionalAuth,
  readFileRoutes,
  writeFileRoutes,
);

app.use(
  "/directory",
  // rateLimitByMethod(LIMITERS.readDirOps, LIMITERS.writeDirOps),
  checkAuth,
  readDirRoutes,
  writeDirRoutes,
);

app.use("/auth", rateLimitMiddleware(LIMITERS.auth), authRoutes);

app.use("/subscription", subscriptionRoutes);
app.use("/user", checkAuth, validateDeletedUser, userRoutes);
app.get("/shared", checkAuth, getSharedWithMe);
app.get("/starred", checkAuth, getStarredItems);
app.get("/trash/{:id}", checkAuth, getTrashItems);
app.patch("/item/:type/:id/toggle-star", checkAuth, toggleItemStar);
app.post("/item/send-link", checkAuth, sendLink);
app.post("/item/sendMail/transfer-ownership", checkAuth, sendOwnershipMail);
app.post("/item/cancel-pending-ownership", checkAuth, cancelOwnershipMail);
app.get(
  "/item/ownership-transfer/:transferId/:action",
  checkAuth,
  ownershipAction,
);
app.post("/item/copy", checkAuth, copyItem);
app.post("/item/move", checkAuth, moveItem);

app.use((err, req, res, next) => {
  console.log(err);
  res.status(err.status || 500).json({ error: "Something went wrong" });
});

app.listen(PORT, () => {
  if (process.send) process.send("ready");
  console.log(`Server Started on PORT ${PORT}`);
});
try {
  await connectDB();
  console.log("MongoDB connected");
} catch (error) {
  console.error("MongoDB connection failed:", error);
}
startSubscriptionCron();
