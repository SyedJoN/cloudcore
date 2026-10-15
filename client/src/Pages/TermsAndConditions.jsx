import React from "react";
import LegalLayout, { LEGAL_CONFIG as C } from "../Components/Layouts/LegalLayout";

const sections = [
  {
    id: "acceptance",
    title: "Acceptance of these terms",
    body: [
      `These Terms & Conditions ("Terms") form a binding agreement between you and ${C.company} ("${C.product}", "we", "us") governing your use of our website, apps, and storage services (the "Service").`,
      "By creating an account or using the Service you agree to these Terms and to our Privacy Policy and Cookie Policy. If you are using the Service on behalf of an organization, you confirm you have authority to bind it.",
    ],
  },
  {
    id: "accounts",
    title: "Eligibility and your account",
    body: [
      {
        list: [
          "You must be at least 13 years old (or the minimum age in your country) to use the Service.",
          "You must provide accurate information and keep it up to date.",
          "You are responsible for keeping your credentials secure and for all activity under your account. Tell us immediately if you suspect unauthorized access.",
          "One person or entity per account unless you are on a team plan that allows multiple seats.",
        ],
      },
    ],
  },
  {
    id: "service-and-plans",
    title: "The Service and storage plans",
    body: [
      "CloudCore lets you store, sync, and share files online. We currently offer the following plans:",
      {
        table: {
          head: ["Plan", "Storage", "Price"],
          rows: [
            ["Starter", "2GB", "Free"],
            ["Pro", "1TB", "$30 per month or $300 per year"],
            ["Business", "10TB", "$50 per month or $500 per year"],
          ],
        },
      },
      "Features and prices may change; changes to a paid plan apply from your next renewal and we will give you advance notice. If you exceed your storage limit, new uploads will pause until you free up space or upgrade. We will not delete your existing files because you are over your limit.",
    ],
  },
  {
    id: "billing",
    title: "Billing, renewals, and refunds",
    body: [
      {
        list: [
          "Paid plans are billed in advance, monthly or yearly depending on the interval you choose, through our payment provider Stripe.",
          "Subscriptions renew automatically until you cancel. You can cancel anytime from your account settings; your plan then stays active until the end of the current billing period.",
          "Free trials (where offered) convert to a paid subscription at the end of the trial unless you cancel before it ends.",
          "Except where required by law, fees are non-refundable once a billing period has started. If you believe you were charged in error, contact us within 30 days.",
          "You are responsible for any applicable taxes.",
        ],
      },
    ],
  },
  {
    id: "your-content",
    title: "Your content",
    body: [
      "You own the files you upload (\"Your Content\"). We do not claim ownership of it.",
      "You grant us a limited, worldwide, non-exclusive license to host, store, transmit, back up, and display Your Content solely as needed to operate and improve the Service for you, including making it available to the people you choose to share it with.",
      "You are responsible for Your Content and for having the rights needed to upload and share it. We are not responsible for content shared by other users.",
    ],
  },
  {
    id: "acceptable-use",
    title: "Acceptable use",
    body: [
      "You agree not to use the Service to:",
      {
        list: [
          "Store or share content that is illegal, including child sexual abuse material, content that incites violence, or content that infringes someone else's rights.",
          "Distribute malware or attempt to disrupt, probe, or gain unauthorized access to the Service or other users' accounts.",
          "Use the Service as a public file-hosting or content-delivery network for large-scale distribution, or resell it without our permission.",
          "Bypass rate limits, cooldowns, or other technical restrictions, or scrape the Service in an automated way without permission.",
          "Impersonate others or misrepresent your affiliation.",
        ],
      },
      "We may remove content or suspend accounts that violate these rules, and may report unlawful content to the appropriate authorities.",
    ],
  },
  {
    id: "copyright",
    title: "Copyright complaints",
    body: [
      `We respect intellectual property rights. If you believe content on the Service infringes your copyright, send a notice to ${C.legalEmail} with a description of the work, the location of the material, your contact details, and a statement made in good faith and under penalty of perjury that you are the rights holder or authorized to act for them. We may remove the content and terminate repeat infringers.`,
    ],
  },
  {
    id: "termination",
    title: "Suspension and termination",
    body: [
      "You can stop using the Service and delete your account at any time. We may suspend or terminate your access if you materially breach these Terms, if required by law, or if your use poses a security risk. Where practical we will give you notice and a chance to export your files first.",
      "When an account is closed, Your Content is deleted as described in our Privacy Policy.",
    ],
  },
  {
    id: "availability",
    title: "Availability and changes to the Service",
    body: [
      "We work hard to keep CloudCore running but we do not guarantee uninterrupted or error-free service. We may modify, suspend, or discontinue features, and will give reasonable notice of changes that materially affect paid plans.",
    ],
  },
  {
    id: "disclaimers",
    title: "Disclaimers",
    body: [
      "The Service is provided \"as is\" and \"as available\" without warranties of any kind, whether express or implied, including merchantability, fitness for a particular purpose, and non-infringement, to the fullest extent permitted by law.",
      { note: "Keep a backup of anything irreplaceable. Cloud storage is a convenience and should not be your only copy of critical data." },
    ],
  },
  {
    id: "liability",
    title: "Limitation of liability",
    body: [
      `To the fullest extent permitted by law, ${C.company} will not be liable for indirect, incidental, special, consequential, or punitive damages, or for loss of data, profits, or revenue. Our total liability for any claim relating to the Service is limited to the greater of (a) the amount you paid us in the 12 months before the claim, or (b) US$100.`,
      "Nothing in these Terms limits liability that cannot be limited by law, such as liability for fraud or for death or personal injury caused by negligence.",
    ],
  },
  {
    id: "governing-law",
    title: "Governing law and disputes",
    body: [
      `These Terms are governed by the laws of ${C.jurisdiction}, without regard to conflict-of-law rules. Disputes will be resolved in the courts of ${C.jurisdiction}, unless mandatory consumer protection laws in your country give you the right to bring a claim elsewhere. We encourage you to contact us first so we can try to resolve any issue informally.`,
    ],
  },
  {
    id: "changes",
    title: "Changes to these Terms",
    body: [
      "We may update these Terms from time to time. For material changes we will notify you by email or in the app at least 30 days in advance. Continuing to use the Service after the effective date means you accept the updated Terms.",
    ],
  },
  {
    id: "contact",
    title: "Contact",
    body: [`Questions about these Terms? Email ${C.legalEmail}.`],
  },
];

export default function TermsAndConditions() {
  return (
    <LegalLayout
      title="Terms & Conditions"
      summary={{
        what: "The rules of the road: what you can expect from CloudCore, what we expect from you, how billing works, and what happens if things go wrong.",
        why: "It's the contract you accept when you sign up. It covers who owns your files (you), what's not allowed, how to cancel, and the limits of our responsibility.",
      }}
      sections={sections}
    />
  );
}