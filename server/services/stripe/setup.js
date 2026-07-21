import Stripe from "stripe"

export const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY
);

export const endpointSecret = process.env.ENDPOINT_SECRET_KEY;
