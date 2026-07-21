export const PLAN_MAP = {
  [process.env.STRIPE_PRO_MONTHLY_PRICE_ID]: {
    plan: "pro",
    storage: 1 * 1000 ** 4,
    uploadLimit: 10 * 1000 ** 3,
    billing: "monthly",
  },
  [process.env.STRIPE_PRO_YEARLY_PRICE_ID]: {
    plan: "pro",
    storage: 1 * 1000 ** 4,
    uploadLimit: 10 * 1000 ** 3,
    billing: "yearly",
  },
  [process.env.STRIPE_BUSINESS_MONTHLY_PRICE_ID]: {
    plan: "business",
    storage: 10 * 1000 ** 4,
    uploadLimit: 50 * 1000 ** 3,
    billing: "monthly",
  },
  [process.env.STRIPE_BUSINESS_YEARLY_PRICE_ID]: {
    plan: "business",
    storage: 10 * 1000 ** 4,
    uploadLimit: 50 * 1000 ** 3,
    billing: "yearly",
  },
  ["STARTER"]: {
    plan: "free",
    storage: 2 * 1000 ** 3,
    uploadLimit: 500 * 1000 ** 2,
  },
};
