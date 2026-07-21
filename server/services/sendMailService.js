import nodemailer from "nodemailer";
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const sendAccessEmail = async function ({
  toEmail,
  toName,
  fromName,
  fromEmail,
  itemName,
  itemType,
  itemUrl,
  role,
  message,
}) {
  try {
    const roleLabel = role === "editor" ? "Editor" : "Viewer";
    const roleColor = role === "editor" ? "#1a73e8" : "#5f6368";
  const itemIcon = itemType === "folder"
  ? `<div style="width:40px;height:40px;background:#fef9e7;border-radius:8px;text-align:center;line-height:40px;font-size:22px;">📁</div>`
  : `<div style="width:40px;height:40px;background:#e8f0fe;border-radius:8px;text-align:center;line-height:40px;font-size:22px;">📄</div>`;

if (!toEmail) throw new Error("toEmail is required but missing");
    const info = await transporter.sendMail({
      from: `"${fromName}" <muhammadjoncs16@gmail.com>`,
      to: toEmail,
      subject: `${fromName} shared "${itemName}" with you`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        </head>
        <body style="margin:0;padding:0;background:#f8f9fa;font-family:'Google Sans',Roboto,Arial,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa;padding:32px 0;">
            <tr>
              <td align="center">
                <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;box-shadow:0 1px 6px rgba(0,0,0,0.1);overflow:hidden;">
                  
                  <!-- Header -->
                  <tr>
                    <td style="padding:24px 32px;border-bottom:1px solid #e8eaed;">
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td>
                            <span style="font-size:20px;font-weight:600;color:#202124;">StorageApp</span>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <!-- Body -->
                  <tr>
                    <td style="padding:32px;">
                      
                      <!-- Sender info -->
                      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                        <tr>
                          <td style="width:44px;vertical-align:top;">
                            <div style="width:40px;height:40px;border-radius:50%;background:#1a73e8;display:block;font-size:18px;font-weight:600;color:#fff;text-align:center;line-height:40px;">
                              ${fromName?.charAt(0)?.toUpperCase()}
                            </div>
                          </td>
                          <td style="padding-left:12px;vertical-align:top;">
                            <div style="font-size:15px;font-weight:500;color:#202124;">${fromName}</div>
                            <div style="font-size:13px;color:#5f6368;">${fromEmail}</div>
                          </td>
                        </tr>
                      </table>

                      <!-- Title -->
                      <h1 style="font-size:22px;font-weight:400;color:#202124;margin:0 0 8px;">
                        Hi ${toName}, ${fromName} shared an item with you
                      </h1>
                      <p style="font-size:14px;color:#5f6368;margin:0 0 24px;">
                        You've been added as <strong style="color:${roleColor};">${roleLabel}</strong>
                      </p>

                      ${message ? `
                      <!-- Message -->
                      <div style="background:#f8f9fa;border-radius:8px;padding:16px;margin-bottom:24px;font-size:14px;color:#3c4043;font-style:italic;">
                        "${message}"
                      </div>
                      ` : ""}

                      <!-- Item card -->
                      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e8eaed;border-radius:8px;margin-bottom:28px;">
                        <tr>
                          <td style="padding:16px;vertical-align:middle;width:48px;">
                            ${itemIcon}
                          </td>
                          <td style="padding:16px 16px 16px 0;vertical-align:middle;">
                            <div style="font-size:15px;font-weight:500;color:#202124;">${itemName}</div>
                            <div style="font-size:12px;color:#5f6368;margin-top:2px;">${itemType === "folder" ? "Folder" : "File"} · ${roleLabel} access</div>
                          </td>
                        </tr>
                      </table>

                      <!-- CTA button -->
                      <table cellpadding="0" cellspacing="0">
                        <tr>
                          <td>
                            <a href="${itemUrl}"
                              style="display:inline-block;background:#1a73e8;color:#ffffff;font-size:14px;font-weight:500;padding:12px 28px;border-radius:6px;text-decoration:none;">
                              Open ${itemType === "folder" ? "folder" : "file"}
                            </a>
                          </td>
                        </tr>
                      </table>

                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="padding:20px 32px;border-top:1px solid #e8eaed;background:#f8f9fa;">
                      <p style="font-size:12px;color:#80868b;margin:0;">
                        This email was sent because ${fromName} shared a ${itemType} with you on StorageApp.
                        If you think this was a mistake, you can ignore this email.
                      </p>
                    </td>
                  </tr>

                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    });

    console.log("Access email sent: %s", info.messageId);
    return info;
  } catch (error) {
    throw error;
  }
};

export const sendRequestAccessEmail = async function ({
toEmail,
itemId,
  toName,
  fromName,
  fromEmail,
  fromUserId, 
  itemName,
  itemType,
  itemUrl,
  role,
  message,
}) {
  try {
    const roleLabel = role === "editor" ? "Editor" : "Viewer";
    const itemIcon = itemType === "folder"
      ? `<div style="width:40px;height:40px;background:#fef9e7;border-radius:8px;text-align:center;line-height:40px;font-size:22px;">📁</div>`
      : `<div style="width:40px;height:40px;background:#e8f0fe;border-radius:8px;text-align:center;line-height:40px;font-size:22px;">📄</div>`;
if (!toEmail) throw new Error("toEmail is required but missing");

    const info = await transporter.sendMail({
      from: `"${fromName}" <muhammadjoncs16@gmail.com>`,
      to: toEmail,
      subject: `${fromName} is requesting access to "${itemName}"`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        </head>
        <body style="margin:0;padding:0;background:#f8f9fa;font-family:'Google Sans',Roboto,Arial,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa;padding:32px 0;">
            <tr>
              <td align="center">
                <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;box-shadow:0 1px 6px rgba(0,0,0,0.1);overflow:hidden;">

                  <!-- Header -->
                  <tr>
                    <td style="padding:24px 32px;border-bottom:1px solid #e8eaed;">
                      <span style="font-size:20px;font-weight:600;color:#202124;">StorageApp</span>
                    </td>
                  </tr>

                  <!-- Body -->
                  <tr>
                    <td style="padding:32px;">

                      <!-- Requester info -->
                      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                        <tr>
                          <td style="width:44px;vertical-align:top;">
                            <div style="width:40px;height:40px;border-radius:50%;background:#ea4335;font-size:18px;font-weight:600;color:#fff;text-align:center;line-height:40px;">
                              ${fromName?.charAt(0)?.toUpperCase()}
                            </div>
                          </td>
                          <td style="padding-left:12px;vertical-align:top;">
                            <div style="font-size:15px;font-weight:500;color:#202124;">${fromName}</div>
                            <div style="font-size:13px;color:#5f6368;">${fromEmail}</div>
                          </td>
                        </tr>
                      </table>

                      <!-- Title -->
                      <h1 style="font-size:22px;font-weight:400;color:#202124;margin:0 0 8px;">
                        Hi ${toName}, ${fromName} is requesting access
                      </h1>
                      <p style="font-size:14px;color:#5f6368;margin:0 0 24px;">
                        They would like <strong>${roleLabel}</strong> access to your ${itemType}.
                      </p>

                      ${message ? `
                      <div style="background:#f8f9fa;border-radius:8px;padding:16px;margin-bottom:24px;font-size:14px;color:#3c4043;font-style:italic;">
                        "${message}"
                      </div>
                      ` : ""}

                      <!-- Item card -->
                      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e8eaed;border-radius:8px;margin-bottom:28px;">
                        <tr>
                          <td style="padding:16px;vertical-align:middle;width:48px;">
                            ${itemIcon}
                          </td>
                          <td style="padding:16px 16px 16px 0;vertical-align:middle;">
                            <div style="font-size:15px;font-weight:500;color:#202124;">${itemName}</div>
                            <div style="font-size:12px;color:#5f6368;margin-top:2px;">${itemType === "folder" ? "Folder" : "File"}</div>
                          </td>
                        </tr>
                      </table>

                      <!-- CTA buttons -->
                      <table cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="padding-right:12px;">
                           <a href="${process.env.CLIENT_URL}/directory/${itemId}?grant=${fromUserId}&role=${role}"
  style="display:inline-block;background:#1a73e8;color:#ffffff;font-size:14px;font-weight:500;padding:12px 28px;border-radius:6px;text-decoration:none;">
  Share "${itemName}"
</a>
                            </a>
                          </td>
                          <td>
                            <a href="${itemUrl}"
                              style="display:inline-block;background:#ffffff;color:#1a73e8;font-size:14px;font-weight:500;padding:12px 28px;border-radius:6px;text-decoration:none;border:1px solid #dadce0;">
                              Open ${itemType === "folder" ? "folder" : "file"}
                            </a>
                          </td>
                        </tr>
                      </table>

                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="padding:20px 32px;border-top:1px solid #e8eaed;background:#f8f9fa;">
                      <p style="font-size:12px;color:#80868b;margin:0;">
                        ${fromName} (${fromEmail}) requested access to your ${itemType} on StorageApp.
                        If you don't recognize this person, you can ignore this email.
                      </p>
                    </td>
                  </tr>

                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    });

    console.log("Request access email sent: %s", info.messageId);
    return info;
  } catch (error) {
    throw error;
  }
};

export const sendLinkEmail = async function ({
  toEmail,
  fromName,
  fromEmail,
  itemName,
  itemType,
  itemUrl,
  isPublic,
  publicRole,
  message,
}) {
  try {
    const accessLabel = isPublic ? "Anyone with the link" : "Restricted";
    const roleLabel = isPublic ? (publicRole === "editor" ? "Editor" : "Viewer") : null;
    const itemIcon = itemType === "folder"
      ? `<div style="width:40px;height:40px;background:#fef9e7;border-radius:8px;text-align:center;line-height:40px;font-size:22px;">📁</div>`
      : `<div style="width:40px;height:40px;background:#e8f0fe;border-radius:8px;text-align:center;line-height:40px;font-size:22px;">📄</div>`;
if (!toEmail) throw new Error("toEmail is required but missing");

    const info = await transporter.sendMail({
      from: `"${fromName}" <muhammadjoncs16@gmail.com>`,
      to: toEmail,
      subject: `${fromName} sent you a link to "${itemName}"`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        </head>
        <body style="margin:0;padding:0;background:#f8f9fa;font-family:'Google Sans',Roboto,Arial,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa;padding:32px 0;">
            <tr>
              <td align="center">
                <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;box-shadow:0 1px 6px rgba(0,0,0,0.1);overflow:hidden;">

                  <!-- Header -->
                  <tr>
                    <td style="padding:24px 32px;border-bottom:1px solid #e8eaed;">
                      <span style="font-size:20px;font-weight:600;color:#202124;">StorageApp</span>
                    </td>
                  </tr>

                  <!-- Body -->
                  <tr>
                    <td style="padding:32px;">

                      <!-- Sender info -->
                      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                        <tr>
                          <td style="width:44px;vertical-align:top;">
                            <div style="width:40px;height:40px;border-radius:50%;background:#1a73e8;font-size:18px;font-weight:600;color:#fff;text-align:center;line-height:40px;">
                              ${fromName?.charAt(0)?.toUpperCase()}
                            </div>
                          </td>
                          <td style="padding-left:12px;vertical-align:top;">
                            <div style="font-size:15px;font-weight:500;color:#202124;">${fromName}</div>
                            <div style="font-size:13px;color:#5f6368;">${fromEmail}</div>
                          </td>
                        </tr>
                      </table>

                      <!-- Title -->
                      <h1 style="font-size:22px;font-weight:400;color:#202124;margin:0 0 8px;">
                        ${fromName} sent you a link
                      </h1>
                      <p style="font-size:14px;color:#5f6368;margin:0 0 24px;">
                        You've received a link to a ${itemType} on StorageApp.
                      </p>

                      ${message ? `
                      <div style="background:#f8f9fa;border-radius:8px;padding:16px;margin-bottom:24px;font-size:14px;color:#3c4043;font-style:italic;">
                        "${message}"
                      </div>
                      ` : ""}

                      <!-- Item card -->
                      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e8eaed;border-radius:8px;margin-bottom:20px;">
                        <tr>
                          <td style="padding:16px;vertical-align:middle;width:56px;">
                            ${itemIcon}
                          </td>
                          <td style="padding:16px 16px 16px 0;vertical-align:middle;">
                            <div style="font-size:15px;font-weight:500;color:#202124;">${itemName}</div>
                            <div style="font-size:12px;color:#5f6368;margin-top:2px;">${itemType === "folder" ? "Folder" : "File"}</div>
                          </td>
                        </tr>
                      </table>

                      <!-- General access info -->
                      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa;border-radius:8px;padding:14px;margin-bottom:24px;">
                        <tr>
                          <td style="vertical-align:middle;width:32px;">
                            <span style="font-size:18px;">${isPublic ? "🌐" : "🔒"}</span>
                          </td>
                          <td style="padding-left:10px;vertical-align:middle;">
                            <div style="font-size:13px;font-weight:500;color:#202124;">${accessLabel}</div>
                            <div style="font-size:12px;color:#5f6368;margin-top:2px;">
                              ${isPublic
                                ? `Anyone on the internet with the link can ${roleLabel?.toLowerCase() || "view"}`
                                : "Only people with access can open this link"}
                            </div>
                          </td>
                          ${roleLabel ? `
                          <td style="text-align:right;vertical-align:middle;">
                            <span style="font-size:12px;color:#5f6368;background:#e8eaed;padding:4px 10px;border-radius:12px;">${roleLabel}</span>
                          </td>` : ""}
                        </tr>
                      </table>

                      <!-- CTA button -->
                      <table cellpadding="0" cellspacing="0">
                        <tr>
                          <td>
                            <a href="${itemUrl}"
                              style="display:inline-block;background:#1a73e8;color:#ffffff;font-size:14px;font-weight:500;padding:12px 28px;border-radius:6px;text-decoration:none;">
                              Open ${itemType === "folder" ? "folder" : "file"}
                            </a>
                          </td>
                        </tr>
                      </table>

                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="padding:20px 32px;border-top:1px solid #e8eaed;background:#f8f9fa;">
                      <p style="font-size:12px;color:#80868b;margin:0;">
                        ${fromName} (${fromEmail}) shared a link with you on StorageApp.
                        If you don't know this person, you can ignore this email.
                      </p>
                    </td>
                  </tr>

                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    });

    console.log("Link email sent: %s", info.messageId);
    return info;
  } catch (error) {
    throw error;
  }
};