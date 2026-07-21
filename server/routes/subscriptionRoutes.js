import express from "express";

import { createSubscription, getCustomerPortalUrl, subscriptionWebhook } from "../controllers/subscriptionController.js";

import { optionalAuth } from "../middlewares/optionalAuthMiddleware.js";
import { checkAuth } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/stripe/create", optionalAuth, express.json(), createSubscription);
router.post("/stripe/events", express.raw({ type: "application/json" }), subscriptionWebhook);
router.get("/stripe/my-plans", checkAuth, express.json(), getCustomerPortalUrl);


export default router;
