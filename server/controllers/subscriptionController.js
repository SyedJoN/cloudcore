import redisClient from "../config/redis.js";
import Subscription from "../models/subscription.model.js";
import User from "../models/user.model.js";
import Webhook from "../models/wehook.model.js";
import { downgradeToFreePlan } from "../services/subscription/downgradeToFreePlan.js";
import { endpointSecret, stripe } from "../services/stripe/setup.js";
import { syncActiveSubscription } from "../services/subscription/syncActiveSubscription.js";
import { PLAN_MAP } from "../utils/planMap.js";
import { pauseUploads } from "../services/subscription/pauseUploads.js";
import { assignPaidPlan } from "../services/subscription/assignPaidPlan.js";
import { resumeUploads } from "../services/subscription/resumeUploads.js";

export const createSubscription = async (req, res, next) => {
  const { priceId } = req.body;

  try {
    const subscription = await Subscription.findOne({
      userId: req.user._id,
    });

    if (subscription?.planId === priceId) {
      return res
        .status(409)
        .json({ message: "You are already subscribed to this plan" });
    }

    const sessionData = {
      mode: "subscription",
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: "http://localhost:5173",
      metadata: {
        userId: req.user._id.toString(),
      },
    };

    if (subscription?.customerId) {
      sessionData.customer = subscription.customerId;
    } else {
      sessionData.customer_email = req.user.email;
    }

    const newSubscription = await stripe.checkout.sessions.create(sessionData);

    return res.status(201).json({ url: newSubscription.url });
  } catch (error) {
    console.log(error);
    next(error);
  }
};

export const subscriptionWebhook = async (req, res, next) => {
  let event;

  try {
    const signature = req.headers["stripe-signature"];

    event = stripe.webhooks.constructEvent(req.body, signature, endpointSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.sendStatus(400);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;

        await assignPaidPlan(session);
        break;
      }

      case "invoice.payment_failed": {
        console.log('payment-failed')
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object;
        console.log("status", subscription.status);
        if (
          subscription.status === "active" ||
          subscription.status === "trialing"
        ) {
          await resumeUploads(subscription);
        } else {
          await pauseUploads(subscription);
        }
        await syncActiveSubscription(subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;

        await downgradeToFreePlan(subscription);
        break;
      }

      default:
        console.log(`Unhandled event: ${event.type}`);
    }

    const existing = await Webhook.findOne({ eventId: event.id });

    if (existing) {
      return res.status(200);
    }

    const webhook = await Webhook.create({
      eventId: event.id,
      type: event.type,
      processed: false,
      payload: event.data.object,
    });
    webhook.processedAt = new Date();
    webhook.processed = true;
    await webhook.save();
    return res.sendStatus(200);
  } catch (error) {
    console.log("error", error);
    next(error);
  }
};

export const getCustomerPortalUrl = async (req, res, next) => {
  const userId = req.user?._id;
  try {
    const subscription = await Subscription.findOne({ userId });
    if (!subscription) {
      return res.status(400).json({
        message: "Customer not found.",
      });
    }
    const customerId = subscription.customerId;
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: "http://localhost:5173",
    });
    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.log(error);
    next(error);
  }
};
