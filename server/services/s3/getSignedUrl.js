import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3 } from "./client.js";

export const createGetSignedUrl = async ({s3Key, fileName, download = false}) => {
  const command = new GetObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET,
    Key: s3Key,
    ResponseContentDisposition: `${download ? "attachment" : "inline"}; filename="${fileName}"`,
  });

  return await getSignedUrl(s3, command, {
    expiresIn: 300,
  });
};
