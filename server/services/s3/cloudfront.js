import { getSignedUrl } from "@aws-sdk/cloudfront-signer";

const privateKey = process.env.CLOUDFRONT_PRIVATE_KEY;
const keyPairId = "K2GEIZQ89ND2VL";
const dateLessThan = new Date(Date.now() + 1000 * 60 * 60).toISOString(); // 1hr

const distributionName = `https://d3rsn8l1s45wnm.cloudfront.net`;
export const getCreateCloudfrontSignedUrl = ({ path, download, fileName }) => {
  const url = `${distributionName}/${path}?response-content-disposition=${encodeURIComponent(download ? "attachment" : "inline")};filename=${fileName}`;
  const signedUrl = getSignedUrl({
    url,
    keyPairId,
    dateLessThan,
    privateKey,
  });
  return signedUrl;
};
