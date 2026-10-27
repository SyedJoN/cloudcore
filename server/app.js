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
import { rateLimitMiddleware } from "./middlewares/rateLimitMiddleware.js";
const app = express();

app.set("trust proxy", 1);

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

// Picks ONE limiter per request based on HTTP method
export const rateLimitByMethod = (readLimiter, writeLimiter) => {
  const read = rateLimitMiddleware(readLimiter);
  const write = rateLimitMiddleware(writeLimiter);
  return (req, res, next) =>
    (READ_METHODS.has(req.method) ? read : write)(req, res, next);
};

const ipLimiter = rateLimitMiddleware(LIMITERS.ipGlobal, (req) => req.ip);
const emailLimiter = rateLimitMiddleware(LIMITERS.emailOps);

const itemLimiter = rateLimitByMethod(LIMITERS.itemRead, LIMITERS.itemWrite)

app.get("/healthz", (req, res) => {
  return res.status(200).json({ message: "SERVING" });
});

app.use((req, res, next) =>
  req.originalUrl.startsWith("/subscription/stripe/events")
    ? next()
    : ipLimiter(req, res, next),
);


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



app.use(
  "/file",
  optionalAuth,
  rateLimitByMethod(LIMITERS.readFileOps, LIMITERS.writeFileOps),
  readFileRoutes,
  writeFileRoutes,
);

app.use(
  "/directory",
  checkAuth,
  rateLimitByMethod(LIMITERS.readDirOps, LIMITERS.writeDirOps),
  readDirRoutes,
  writeDirRoutes,
);

app.use("/auth", rateLimitMiddleware(LIMITERS.auth), authRoutes);

app.use("/subscription", subscriptionRoutes);
app.use("/user", checkAuth, validateDeletedUser, itemLimiter, userRoutes);
app.get("/shared", checkAuth, itemLimiter, getSharedWithMe);
app.get("/starred", checkAuth, itemLimiter, getStarredItems);
app.get("/trash/{:id}", checkAuth, itemLimiter, getTrashItems);
app.patch("/item/:type/:id/toggle-star", checkAuth, itemLimiter, toggleItemStar);
app.post("/item/send-link", checkAuth, emailLimiter, sendLink);
app.post("/item/sendMail/transfer-ownership", checkAuth, emailLimiter, sendOwnershipMail);
app.post("/item/cancel-pending-ownership", checkAuth, itemLimiter, cancelOwnershipMail);
app.get(
  "/item/ownership-transfer/:transferId/:action",
  checkAuth,
  itemLimiter,
  ownershipAction,
);
app.post("/item/copy", checkAuth, itemLimiter, copyItem);
app.post("/item/move", checkAuth, itemLimiter, moveItem);

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
