import { DeleteObjectCommand } from "@aws-sdk/client-s3"
import { cloudfront, s3 } from "./client.js";
import { CreateInvalidationCommand } from "@aws-sdk/client-cloudfront";
import { randomUUID } from "node:crypto";

export const deleteFile = async (key) => {
  const command = new DeleteObjectCommand ({
    Bucket: process.env.AWS_S3_BUCKET,
    Key: key
  });
await s3.send(command);
  const invalidation = new CreateInvalidationCommand({
    DistributionId: process.env.AWS_CLOUDFRONT_DISTRIBUTION_ID,
    InvalidationBatch: {
      CallerReference: randomUUID(),
      Paths: {
        Quantity: 1,
        Items: [`/${key}*`],
      },
    },
  });
  const response = await cloudfront.send(invalidation);
};

