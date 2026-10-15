import React from "react";
import LegalLayout, { LEGAL_CONFIG as C } from "./LegalLayout";

const MIT_TEXT = `MIT License

Copyright (c) 2026 Cloudcore

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;

const sections = [
  {
    id: "our-software",
    title: "CloudCore software",
    body: [
      `The ${C.product} application, its source code, design, logo, and branding are the property of ${C.company} and are protected by copyright and trademark law. All rights reserved.`,
      "Your subscription gives you a limited, personal, non-transferable right to use the Service under our Terms & Conditions. It does not grant you any right to copy, modify, redistribute, or reverse engineer our software or to use our name and logo.",
    ],
  },
  {
    id: "open-source",
    title: "Open-source software",
    body: [
      "CloudCore is built on the work of the open-source community. We are grateful to the maintainers of these projects and comply with their license terms.",
      {
        table: {
          head: ["Package", "Used for", "License"],
          rows: [
            // Frontend
            ["React", "User interface", "MIT"],
            ["React DOM", "Rendering React components in the browser", "MIT"],
            ["React Router", "Page navigation and routing", "MIT"],
            ["Tailwind CSS", "Styling", "MIT"],
            [
              "Tailwind CSS Vite Plugin",
              "Tailwind CSS integration with Vite",
              "MIT",
            ],
            ["Zod", "Form and input validation", "MIT"],
            ["Axios", "HTTP requests to our API", "MIT"],
            ["Google Drive Picker React", "Google Drive file selection", "MIT"],
            ["Heroicons React", "UI icons", "MIT"],
            ["Google OAuth React", "Google sign-in and authentication", "MIT"],
            ["Lucide React", "UI icons", "ISC"],
            ["React Icons", "Icon library", "MIT"],

            // Backend
            [
              "AWS SDK for JavaScript. S3 Client",
              "Amazon S3 file storage operations",
              "Apache-2.0",
            ],
            [
              "AWS SDK S3 Request Presigner",
              "Generating presigned S3 URLs",
              "Apache-2.0",
            ],
            [
              "OpenFGA SDK",
              "Fine-grained authorization and access control",
              "Apache-2.0",
            ],
            ["Archiver", "Creating compressed archives", "MIT"],
            ["Bcrypt", "Password hashing", "MIT"],
            ["Cookie Parser", "Parsing HTTP cookies", "MIT"],
            ["CORS", "Cross-origin resource sharing", "MIT"],
            ["Dotenv", "Loading environment variables", "BSD-2-Clause"],
            ["Express", "Backend web server and API framework", "MIT"],
            ["Express Rate Limit", "Limiting repeated HTTP requests", "MIT"],
            [
              "Google Auth Library",
              "Google authentication and OAuth",
              "Apache-2.0",
            ],
            ["Google APIs", "Integrating with Google APIs", "Apache-2.0"],
            ["Helmet", "HTTP security headers", "MIT"],
            ["ioredis", "Redis client", "MIT"],
            ["Mime Types", "Mapping file extensions to MIME types", "MIT"],
            ["Mongoose", "MongoDB object modeling", "MIT"],
            ["Node Cron", "Scheduling recurring tasks", "ISC"],
            ["Nodemailer", "Sending emails", "MIT"],
            [
              "Rate Limiter Flexible",
              "Rate limiting and abuse prevention",
              "MIT",
            ],
            ["Redis", "Redis client", "MIT"],
            ["Sanitize HTML", "Sanitizing HTML content", "MIT"],
            ["Stripe", "Payment processing integration", "MIT"],

            // Development tools
            ["ESLint", "JavaScript linting", "MIT"],
            ["ESLint JS", "JavaScript linting configuration", "MIT"],
            ["ESLint Plugin React", "React-specific linting rules", "MIT"],
            ["ESLint Plugin React Hooks", "Linting React Hooks usage", "MIT"],
            [
              "ESLint Plugin React Refresh",
              "React Fast Refresh linting rules",
              "MIT",
            ],
            ["Globals", "Global variable definitions for linting", "MIT"],
            ["TypeScript React Types", "Type definitions for React", "MIT"],
            [
              "TypeScript React DOM Types",
              "Type definitions for React DOM",
              "MIT",
            ],
            ["Vite", "Frontend development server and build tool", "MIT"],
            ["Vite React Plugin", "React integration for Vite", "MIT"],
            ["Prettier", "Code formatting", "MIT"],
            [
              "License Checker",
              "Checking third-party dependency licenses",
              "BSD-3-Clause",
            ],
          ],
        },
      },
    ],
  },
  {
    id: "fonts",
    title: "Fonts",
  body: [
  "Space Grotesk and Inter are open-source fonts licensed under the SIL Open Font License 1.1 and served via Google Fonts.",
  "Google Sans and Roboto are also used in the project and loaded via Google Fonts."
]
  },
  {
    id: "mit-text",
    title: "MIT License text",
    body: [
      "Most of the packages above are released under the MIT License. The standard text is reproduced below; each project's copyright line is available in its own repository.",
      { code: MIT_TEXT },
    ],
  },
  {
    id: "other-licenses",
    title: "Other licenses",
    body: [
      {
        list: [
          "Apache License 2.0: permits use, modification, and distribution, with attribution and a copy of the license retained.",
          "BSD (2/3-Clause): similar to MIT, with attribution required and (3-Clause) no endorsement using contributors' names.",
          "ISC: functionally equivalent to MIT.",
          "SIL OFL 1.1: allows free use and embedding of fonts, but the fonts may not be sold on their own.",
        ],
      },
    ],
  },

  {
    id: "contact",
    title: "Attribution requests",
    body: [
      `If you believe we've missed an attribution, email ${C.legalEmail} and we'll fix it promptly.`,
    ],
  },
];

export default function Licenses() {
  return (
    <LegalLayout
      title="Licenses"
      summary={{
        what: "A list of who owns CloudCore's software and which open-source libraries it's built on, with their licenses.",
        why: "Open-source licenses require us to credit the projects we use. It also makes clear what you may and may not do with our software and brand.",
      }}
      sections={sections}
    />
  );
}
