import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3 } from "./client.js";

export const getSignedUploadUrl = async (key, contentType) => {
  const command = new PutObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET,
    Key: key,
    ContentType: contentType || "application/octet-stream",
  });

  const url = await getSignedUrl(s3, command, {
    expiresIn: 3600,
    signableHeaders: new Set(['content-type']),
  });

  return url;
};

