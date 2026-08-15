import {
  CopyObjectCommand,
} from "@aws-sdk/client-s3";
import { s3 } from "./client.js";


const copyS3File = async (sourceKey, destinationKey) => {
  await s3.send(
    new CopyObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,

      CopySource: `${process.env.AWS_S3_BUCKET}/${sourceKey}`,

      Key: destinationKey,
    })
  );

  return destinationKey;
};
export default copyS3File