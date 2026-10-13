/**
 * `npm run test:s3` only: keep the S3 test bucket clean. Before the run, objects older than an hour
 * (leftovers of crashed runs) are removed; after it, everything this run wrote. Objects a concurrent
 * run wrote in the last hour are left alone. Refuses any bucket whose name doesn't contain "test".
 */
import { DeleteObjectsCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';

async function purge(client: S3Client, bucket: string, match: (modifiedAt: Date) => boolean): Promise<number> {
  let deleted = 0;
  let token: string | undefined;
  do {
    const page = await client.send(new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: token }));
    const keys = (page.Contents ?? []).filter((o) => o.Key && o.LastModified && match(o.LastModified)).map((o) => ({ Key: o.Key! }));
    if (keys.length) {
      await client.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: keys, Quiet: true } }));
      deleted += keys.length;
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return deleted;
}

export default async function s3GlobalSetup(): Promise<() => Promise<void>> {
  const bucket = process.env.S3_TEST_BUCKET ?? '';
  if (!bucket.includes('test')) throw new Error(`Refusing to run S3 tests against bucket "${bucket}" (its name must contain "test")`);
  const client = new S3Client({
    endpoint: process.env.S3_TEST_ENDPOINT,
    region: process.env.S3_TEST_REGION || 'garage',
    forcePathStyle: true,
    credentials: { accessKeyId: process.env.S3_TEST_ACCESS_KEY_ID ?? '', secretAccessKey: process.env.S3_TEST_SECRET_ACCESS_KEY ?? '' },
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
  // Garage's clock and ours may differ by a little: one minute of slack.
  const started = Date.now() - 60_000;
  await purge(client, bucket, (at) => at.getTime() < Date.now() - 3600_000);
  return async () => {
    await purge(client, bucket, (at) => at.getTime() >= started);
    client.destroy();
  };
}
