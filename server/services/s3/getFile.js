
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { s3 } from "./client.js";


export const getFile = async (key) => {
  const command = new GetObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET,
    Key: key,
    ResponseContentDisposition: "inline"
  });

  const response = await s3.send(command);
  return response;
};