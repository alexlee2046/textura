import COS from "cos-nodejs-sdk-v5";

const SECRET_ID = process.env.COS_SECRET_ID;
const SECRET_KEY = process.env.COS_SECRET_KEY;
const BUCKET = process.env.COS_BUCKET;
const REGION = process.env.COS_REGION ?? "ap-guangzhou";
const CDN_DOMAIN = process.env.COS_CDN_DOMAIN;

export const isCosConfigured = !!(SECRET_ID && SECRET_KEY && BUCKET);

let client: COS | null = null;

function getCos(): COS {
  if (!client) {
    client = new COS({ SecretId: SECRET_ID!, SecretKey: SECRET_KEY! });
  }
  return client;
}

function cosUrl(key: string): string {
  return CDN_DOMAIN
    ? `https://${CDN_DOMAIN}/${key}`
    : `https://${BUCKET}.cos.${REGION}.myqcloud.com/${key}`;
}

export async function uploadToCos(
  key: string,
  buffer: Buffer,
  contentType: string,
): Promise<string> {
  if (!isCosConfigured) {
    throw new Error("COS not configured");
  }

  await new Promise<void>((resolve, reject) => {
    getCos().putObject(
      {
        Bucket: BUCKET!,
        Region: REGION,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      },
      (err: COS.CosError) =>
        err
          ? reject(new Error(`COS upload failed: ${err.message}`))
          : resolve(),
    );
  });

  return cosUrl(key);
}
