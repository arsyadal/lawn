import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import S3rver from 's3rver';

export interface InProcessS3 {
  endpoint: string;
  close: () => Promise<void>;
}

/**
 * Boots a real (in-process) S3-compatible HTTP server on a free local port so the
 * storage integration spec can exercise genuine presigned PUT/GET traffic without
 * Docker or an external MinIO. The server implementation validates signature-v4
 * presigned URLs exactly like S3 does.
 */
export async function startInProcessS3(): Promise<InProcessS3> {
  const directory = mkdtempSync(join(tmpdir(), 'lawn-s3rver-'));
  const instance = new S3rver({ address: '127.0.0.1', port: 0, silent: true, directory, vhostBuckets: false });
  const address = await instance.run();
  return {
    endpoint: `http://127.0.0.1:${address.port}`,
    close: async () => {
      await instance.close();
      rmSync(directory, { recursive: true, force: true });
    },
  };
}
