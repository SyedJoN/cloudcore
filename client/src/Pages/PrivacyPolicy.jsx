import React from "react";
import LegalLayout, { LEGAL_CONFIG as C } from "../Components/Layouts/LegalLayout";

const sections = [
  {
    id: "overview",
    title: "Overview",
    body: [
      `${C.company} ("${C.product}", "we", "us") provides cloud file storage and syncing. This Privacy Policy explains what personal information we collect, why we collect it, who we share it with, and the choices you have.`,
      "By creating an account or using the service, you acknowledge that you have read this policy. If you do not agree with it, please do not use the service.",
    ],
  },
  {
    id: "information-we-collect",
    title: "Information we collect",
    body: [
      "We collect only what we need to run the service.",
      {
        list: [
          "Account information: your name, email address, and a password (stored only as a salted hash, never in plain text). If you sign in with Google or GitHub, we receive your name, email, and profile identifier from that provider.",
          "Your files and metadata: the files and folders you upload, along with names, sizes, types, timestamps, and sharing settings.",
          "Billing information: your plan, billing interval, and subscription status. Card details are collected and processed by our payment provider, Stripe; we never see or store your full card number.",
          "Usage and device data: IP address, browser and device type, operating system, and basic activity logs (such as login attempts and errors) used for security and reliability.",
          "Verification data: one-time passcodes (OTPs) sent to your email and the timestamps used to enforce expiry and cooldowns.",
          "Communications: messages you send to support.",
        ],
      },
    ],
  },
  {
    id: "how-we-use",
    title: "How we use your information",
    body: [
      {
        list: [
          "To provide the service: create your account, authenticate you, store and sync your files, and let you share them.",
          "To process payments and manage your subscription.",
          "To keep the service secure: detect abuse, prevent fraud, and enforce rate limits and cooldowns.",
          "To communicate with you: send verification codes, receipts, security alerts, and important service notices.",
          "To improve the product: understand which features are used and fix bugs, using aggregated or de-identified data wherever possible.",
          "To meet legal obligations and enforce our Terms.",
        ],
      },
      { note: "We do not sell your personal information, and we do not use the contents of your files for advertising." },
    ],
  },
  {
    id: "your-files",
    title: "Your files and who can see them",
    body: [
      "Your files belong to you. By default they are private to your account and visible only to the people you explicitly share them with.",
      "Files are encrypted in transit (TLS) and at rest. Our staff do not access the contents of your files, except where strictly necessary to resolve a support request you have asked us to look into, to investigate a security incident, or where required by law.",
    ],
  },
  {
    id: "sharing",
    title: "Who we share information with",
    body: [
      "We share personal information only with service providers who help us operate CloudCore, and only to the extent needed for their role.",
      {
        table: {
          head: ["Provider type", "Purpose", "Data involved"],
          rows: [
            ["Payment processor (Stripe)", "Processing payments and subscriptions", "Email, plan, billing details"],
            ["Email delivery (SMTP provider)", "Sending OTPs and account emails", "Email address, message content"],
            ["Sign-in providers (Google, GitHub)", "Optional social sign-in", "Name, email, profile identifier"],
            ["Cloud hosting & storage", "Running the app and storing files", "Account data, encrypted file data"],
          ],
        },
      },
      "We may also disclose information if required by law, to protect the rights and safety of our users or the public, or as part of a merger, acquisition, or sale of assets (in which case we will notify you before your data becomes subject to a different policy).",
    ],
  },
  {
    id: "retention",
    title: "How long we keep data",
    body: [
      "We keep your account and files for as long as your account is active. When you delete a file it is removed from your account immediately and purged from our systems, including backups, within 30 days.",
      "If you delete your account, we delete your personal information and files within 30 days, except for records we must keep for tax, accounting, fraud prevention, or legal reasons (for example, invoices).",
    ],
  },
  {
    id: "security",
    title: "Security",
    body: [
      "We use industry-standard safeguards including encryption in transit and at rest, hashed passwords, email-based one-time passcodes, rate limiting, and access controls. No system is perfectly secure, so we encourage you to use a strong, unique password and keep your devices up to date.",
      "If we become aware of a breach affecting your personal information, we will notify you and the relevant authorities as required by law.",
    ],
  },
  {
    id: "your-rights",
    title: "Your rights and choices",
    body: [
      "Depending on where you live (for example under the GDPR or the CCPA/CPRA), you may have the right to:",
      {
        list: [
          "Access the personal information we hold about you and receive a copy in a portable format.",
          "Correct information that is inaccurate or incomplete.",
          "Delete your information and close your account.",
          "Object to or restrict certain processing, and withdraw consent where we rely on it.",
          "Not be discriminated against for exercising your rights.",
        ],
      },
      `You can manage most of this from your account settings. For anything else, email ${C.legalEmail} and we will respond within 30 days.`,
    ],
  },
  {
    id: "children",
    title: "Children",
    body: [
      "CloudCore is not intended for children under 13 (or under 16 where local law requires). We do not knowingly collect personal information from children. If you believe a child has given us personal information, contact us and we will delete it.",
    ],
  },
  {
    id: "transfers",
    title: "International transfers",
    body: [
      "We may process and store information in countries other than your own. Where we transfer data across borders, we use appropriate safeguards such as Standard Contractual Clauses.",
    ],
  },
  {
    id: "changes",
    title: "Changes to this policy",
    body: [
      "We may update this policy from time to time. If we make material changes, we will notify you by email or in the app before they take effect. The date at the top of this page shows when it was last revised.",
    ],
  },
  {
    id: "contact",
    title: "Contact us",
    body: [
      `Questions or requests? Email ${C.legalEmail}, or write to ${C.company}`,
    ],
  },
];

export default function PrivacyPolicy() {
  return (
    <LegalLayout
      title="Privacy Policy"
      summary={{
        what: "A plain statement of what personal data CloudCore collects, what we do with it, who we share it with, and how long we keep it.",
        why: "You're trusting us with your files and identity. This page tells you exactly how they are handled and how to access, export, or delete your data.",
      }}
      sections={sections}
    />
  );
}