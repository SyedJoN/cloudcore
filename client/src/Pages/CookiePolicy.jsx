import React from "react";
import LegalLayout, { LEGAL_CONFIG as C } from "../Components/Layouts/LegalLayout";

const sections = [
  {
    id: "what-are-cookies",
    title: "What are cookies?",
    body: [
      "Cookies are small text files that a website stores in your browser. They let a site remember you between page loads, keep you signed in, and remember preferences. We also use similar technologies such as your browser's local storage, which this policy refers to together as \"cookies\".",
    ],
  },
  {
    id: "how-we-use",
    title: "How we use cookies",
    body: [
      `${C.product} uses a small number of cookies, mostly to keep you securely signed in and to make the app work. We group them into three categories:`,
      {
        list: [
          "Strictly necessary: required for the Service to function (sign-in sessions, security, abuse prevention). These cannot be switched off.",
          "Functional: remember choices and states you've made, such as a retry cooldown after too many verification attempts.",
          "Analytics (optional): help us understand how the product is used so we can improve it. We only set these if you consent.",
        ],
      },
    ],
  },
  {
    id: "cookies-we-set",
    title: "Cookies and storage we use",
    body: [
      {
        table: {
          head: ["Name", "Category", "Purpose", "Duration"],
          rows: [
            ["sid", "Strictly necessary", "Keeps you signed in after you verify your login with an OTP.", "Session / up to 7 days"],
            ["cooldownExpiry (local storage)", "Functional", "Remembers when your OTP retry cooldown ends so it isn't lost on page refresh.", "Until the cooldown expires"],
            ["Stripe cookies (third party)", "Strictly necessary", "Fraud prevention and secure payment processing on checkout.", "Set by Stripe"],
            ["Google / GitHub (third party)", "Functional", "Used only if you choose to sign in with those providers.", "Set by the provider"],

          ],
        },
      },
    ],
  },
  {
    id: "third-party",
    title: "Third-party cookies",
    body: [
      "Some cookies are set by services we rely on, such as our payment provider and the sign-in providers listed above. We don't control these cookies; please refer to those providers' own privacy and cookie policies for details.",
    ],
  },
  {
    id: "your-choices",
    title: "Managing your cookie preferences",
    body: [
      {
        list: [
          "Browser settings: you can block or delete cookies in your browser. Blocking strictly necessary cookies will stop sign-in from working.",
          "Consent: where we ask for consent to optional cookies, you can change your choice at any time from the cookie settings link in the footer.",
          "Do Not Track / Global Privacy Control: where required by law we honor these signals for optional cookies.",
        ],
      },
    ],
  },
  {
    id: "changes",
    title: "Changes to this policy",
    body: [
      "We may update this Cookie Policy as our product or the law changes. The date at the top of the page shows the latest revision.",
    ],
  },
  {
    id: "contact",
    title: "Contact",
    body: [`Questions about cookies? Email ${C.privacyEmail}.`],
  },
];

export default function CookiePolicy() {
  return (
    <LegalLayout
      title="Cookie Policy"
      summary={{
        what: "A list of the cookies and browser storage CloudCore uses, what each one does, and how long it lasts.",
        why: "We use essential cookies to maintain your sign-in session, authenticate users, and help keep your account secure. These cookies are necessary for the website's core functionality. If we introduce non-essential cookies, such as analytics or advertising cookies, we will explain their purposes and obtain consent where required by applicable law.",
      }}
      sections={sections}
    />
  );
}