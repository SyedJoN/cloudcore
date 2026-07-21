import { DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { s3 } from "./client.js";

export async function deleteFileArray(files) {
     if (!files?.length) return;
  const command = new DeleteObjectsCommand({
    Bucket: process.env.AWS_S3_BUCKET,
    Delete: {
      Objects: files.map(({ _id, extension }) => ({
        Key: `${_id}${extension}`,
      })),
    },
  });
  
  await s3.send(command);
}
