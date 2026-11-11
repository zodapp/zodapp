import {
  BatchGetItemCommand,
  BatchWriteItemCommand,
  type AttributeValue,
  type DynamoDBClient,
  type WriteRequest,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

type Raw = Record<string, unknown>;

export const toAttributes = (raw: Raw): Record<string, AttributeValue> =>
  marshall(raw, {
    removeUndefinedValues: true,
    convertClassInstanceToMap: false,
  });

export const fromAttributes = (
  attributes: Record<string, AttributeValue> | undefined,
): Raw | undefined => (attributes ? unmarshall(attributes) : undefined);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const backoff = (attempt: number) =>
  sleep(Math.min(1000, 25 * 2 ** attempt) * (0.5 + Math.random() / 2));

const MAX_UNPROCESSED_RETRIES = 8;
const BATCH_GET_SIZE = 100;
const BATCH_WRITE_SIZE = 25;

const keyId = (key: Raw, pk: string, sk: string) =>
  `${String(key[pk])}\u0000${String(key[sk])}`;

/**
 * BatchGetItemで本体を強い整合性で取得する。1回100件まで、未処理のキーは再試行する（§6.3）。
 */
export const batchGet = async (
  client: DynamoDBClient,
  tableName: string,
  primary: { pk: string; sk: string },
  keys: readonly Raw[],
): Promise<Map<string, Raw>> => {
  const out = new Map<string, Raw>();
  const unique = new Map<string, Raw>();
  for (const k of keys) unique.set(keyId(k, primary.pk, primary.sk), k);
  const all = [...unique.values()];
  for (let i = 0; i < all.length; i += BATCH_GET_SIZE) {
    let pending: Record<string, AttributeValue>[] = all
      .slice(i, i + BATCH_GET_SIZE)
      .map((k) =>
        toAttributes({
          [primary.pk]: k[primary.pk],
          [primary.sk]: k[primary.sk],
        }),
      );
    for (let attempt = 0; pending.length > 0; attempt++) {
      if (attempt > MAX_UNPROCESSED_RETRIES) {
        throw new Error("BatchGetItem: too many unprocessed keys");
      }
      if (attempt > 0) await backoff(attempt);
      const res = await client.send(
        new BatchGetItemCommand({
          RequestItems: {
            [tableName]: { Keys: pending, ConsistentRead: true },
          },
        }),
      );
      for (const item of res.Responses?.[tableName] ?? []) {
        const raw = unmarshall(item);
        out.set(keyId(raw, primary.pk, primary.sk), raw);
      }
      pending = res.UnprocessedKeys?.[tableName]?.Keys ?? [];
    }
  }
  return out;
};

export const lookupBatchGet = (
  results: Map<string, Raw>,
  primary: { pk: string; sk: string },
  key: Raw,
) => results.get(keyId(key, primary.pk, primary.sk));

/**
 * BatchWriteItemで一括して書き込む。1回25件まで、未処理のItemは再試行する（§6.6）。
 */
export const batchWrite = async (
  client: DynamoDBClient,
  tableName: string,
  requests: readonly WriteRequest[],
  onChunk?: (count: number) => void | Promise<void>,
): Promise<void> => {
  for (let i = 0; i < requests.length; i += BATCH_WRITE_SIZE) {
    const chunk = requests.slice(i, i + BATCH_WRITE_SIZE);
    let pending: WriteRequest[] = [...chunk];
    for (let attempt = 0; pending.length > 0; attempt++) {
      if (attempt > MAX_UNPROCESSED_RETRIES) {
        throw new Error("BatchWriteItem: too many unprocessed items");
      }
      if (attempt > 0) await backoff(attempt);
      const res = await client.send(
        new BatchWriteItemCommand({ RequestItems: { [tableName]: pending } }),
      );
      pending = res.UnprocessedItems?.[tableName] ?? [];
    }
    await onChunk?.(chunk.length);
  }
};

export { backoff };
