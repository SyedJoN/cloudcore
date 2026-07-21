import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { s3 } from "./client.js";


export const getFileSize = async (key) => {
  const command = new HeadObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET,
    Key: key
  });

const result = await s3.send(command);
return result.ContentLength;
};

