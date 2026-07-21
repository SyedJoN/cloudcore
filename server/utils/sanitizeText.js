import sanitizeHtml from "sanitize-html";

export const sanitizeText = (value) => {
  if (typeof value !== "string") return value;

  return sanitizeHtml(value, {
    allowedTags: [],
    allowedAttributes: {},
  });
};