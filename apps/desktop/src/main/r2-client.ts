import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

export interface R2ClientConfig {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  region?: string;
}

function buildEndpoint(accountId: string): string {
  const id = accountId.trim();
  if (!id) throw new Error("Account ID 不能为空");
  return `https://${id}.r2.cloudflarestorage.com`;
}

export function resolveR2Endpoint(input: { accountId?: string | undefined; endpoint?: string | undefined }): string {
  if (input.endpoint?.trim()) return input.endpoint.trim();
  return buildEndpoint(input.accountId ?? "");
}

export class R2Client {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config: R2ClientConfig) {
    this.client = new S3Client({
      region: config.region ?? "auto",
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: true,
    });
    this.bucket = config.bucketName;
  }

  async putJson(key: string, data: unknown): Promise<void> {
    const body = JSON.stringify(data, null, 2);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: "application/json",
      }),
    );
  }

  async getJson<T>(key: string): Promise<T | undefined> {
    try {
      const response = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      const chunks: Buffer[] = [];
      for await (const chunk of response.Body as AsyncIterable<Buffer>) {
        chunks.push(chunk);
      }
      const text = Buffer.concat(chunks).toString("utf8");
      return JSON.parse(text) as T;
    } catch (error) {
      if (isNotFound(error)) return undefined;
      throw error;
    }
  }

  async list(prefix: string): Promise<Array<{ key: string; lastModified: Date }>> {
    const result: Array<{ key: string; lastModified: Date }> = [];
    let continuationToken: string | undefined;
    do {
      const response = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        }),
      );
      for (const object of response.Contents ?? []) {
        if (object.Key && object.LastModified) {
          result.push({ key: object.Key, lastModified: object.LastModified });
        }
      }
      continuationToken = response.NextContinuationToken;
    } while (continuationToken);
    return result;
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async testConnection(): Promise<{ ok: boolean; message: string }> {
    try {
      // R2 的 Object Read & Write access key 不支持 HeadBucket，用 ListObjects 测试
      await this.client.send(
        new ListObjectsV2Command({ Bucket: this.bucket, MaxKeys: 1, Prefix: "_sync/" }),
      );
      return { ok: true, message: "连接成功 ✅" };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("Could not resolve")) {
        return { ok: false, message: "无法解析 R2 端点，请检查 Account ID 或 Endpoint" };
      }
      if (message.includes("Forbidden") || message.includes("InvalidAccessKeyId")) {
        return { ok: false, message: "Access Key 或 Secret Key 不正确" };
      }
      if (message.includes("NoSuchBucket")) {
        return { ok: false, message: "Bucket 不存在" };
      }
      return { ok: false, message: `连接失败：${message}` };
    }
  }
}

function isNotFound(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message;
  return (
    message.includes("NoSuchKey") ||
    message.includes("Not Found") ||
    message.includes("404")
  );
}
