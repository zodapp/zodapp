import { randomUUID } from "node:crypto";
import {
  ConditionalCheckFailedException,
  DeleteItemCommand,
  GetItemCommand,
  PutItemCommand,
  QueryCommand,
  SearchVectorsCommand,
  TransactionCanceledException,
  TransactWriteItemsCommand,
  UpdateItemCommand,
  type AttributeValue,
  type DynamoDBClient,
  type TransactWriteItem,
} from "@aws-sdk/client-dynamodb";
import {
  composeKey,
  CorruptedDataError,
  DefinitionError,
  SEPARATOR,
  ValidationError,
  VERSION_ATTRIBUTE,
  buildFilters,
  withVectorRuntime,
  type VectorImpl,
  type AnyTableConfig,
  type BatchMarker,
  type ChangeListener,
  type ChangeRecord,
  type CompiledVector,
  type AnyOp,
  type OpRequest,
  isOp,
  type Override,
  type ContextMark,
  type OverrideImpl,
  type ItemOf,
  type KeyFieldsOf,
  type MutationDef,
  type OmittedOf,
  type PatchOf,
  type ProjectedOf,
  type QueryDef,
  type SearchDef,
  type TableKey,
  type VectorRuntimeConfig,
  type WhereOf,
  type WriteOrigin,
} from "@zodapp/zod-dynamodb";
import type { z } from "zod";
import {
  authorizeOp,
  effectiveMutation,
  effectiveSearch,
  executeOp,
  overrideMap,
  type ExecuteOptions,
} from "./ops";
import {
  signCursor,
  signItemToken,
  verifyCursor,
  verifyItemToken,
} from "./cursor";
import {
  backoff,
  batchGet,
  batchWrite,
  fromAttributes,
  lookupBatchGet,
  toAttributes,
} from "./dynamo";
import {
  EntityCodec,
  type FieldSelection,
  type VectorConfigResolver,
} from "./entity";
import {
  ConditionFailedError,
  ConflictError,
  InvalidCursorError,
  ItemAlreadyExistsError,
  ItemNotFoundError,
  StaleItemError,
  TransactionError,
} from "./errors";
import {
  and,
  applyActions,
  buildUpdateExpression,
  ExpressionContext,
  marshallValue,
  type UpdateActions,
} from "./expression";
import {
  buildCreate,
  buildSet,
  finalizeUpdate,
  planUpdate,
  type UpdatePlan,
} from "./writes";
import { Validated, validatedOr } from "./validated";

type Raw = Record<string, unknown>;

/** 1回の確定で扱える操作の上限 */
const MAX_TRANSACTION_ITEMS = 100;
const DEFAULT_MAX_RETRIES = 5;

// ---- 公開する型 ----

type Selected<TT extends AnyTableConfig, S> = S extends {
  pick: readonly (infer P)[];
}
  ? ProjectedOf<ItemOf<TT>, P | KeyFieldsOf<TT>>
  : S extends { omit: readonly (infer O)[] }
    ? OmittedOf<ItemOf<TT>, Exclude<O, KeyFieldsOf<TT>>>
    : ItemOf<TT>;

type FieldSelectionOf<TT extends AnyTableConfig> =
  | { pick: readonly (keyof ItemOf<TT> & string)[] }
  | { omit: readonly (keyof ItemOf<TT> & string)[] };

type GenerateArgsOf<TT extends AnyTableConfig> = TT["generateKey"] extends
  ((args: infer A, input: never) => unknown) | undefined
  ? A
  : never;

export type QueryResult<TItem> = {
  items: TItem[];
  /** 次のページのトークン。最後のページにはない */
  cursor?: string;
  /** `withVersions` を指定したときの、各Itemの `version`（`items` と同じ順） */
  versions?: number[];
};

export type QueryOptions<TContext> = {
  limit?: number;
  cursor?: string;
  context?: TContext;
  /**
   * 各Itemの `version` も返す（リアルタイムの同期に使う。§10.2）。
   * `KEYS_ONLY` / `INCLUDE` のIndexでは、本体を強い整合性で読み、その内容と `version` を返す
   */
  withVersions?: boolean;
};

/** トランザクションやbatchに結び付けたアクセサ */
export type RunnerAccessor<TT extends AnyTableConfig> = {
  create(key: TableKey<TT>, input: z.input<TT["create"]>): Promise<ItemOf<TT>>;
  /** `generateKey` でキーを生成して作成する（§6.2） */
  createWithGeneratedKey(
    args: GenerateArgsOf<TT>,
    input: z.input<TT["create"]>,
  ): Promise<ItemOf<TT>>;
  set(key: TableKey<TT>, input: z.input<TT["item"]>): Promise<ItemOf<TT>>;
  update(
    key: TableKey<TT>,
    patch: PatchOf<ItemOf<TT>>,
    options?: { where?: WhereOf<ItemOf<TT>>; ifUnchanged?: string },
  ): Promise<ItemOf<TT>>;
  /** 名前付きミューテーション（`createOps` の `o.mutation`）。上書き（`overrides`）も効く */
  mutate<M extends MutationDef<TT, z.ZodType, any>>(
    mutation: M,
    key: TableKey<TT>,
    params: z.input<M["params"]>,
    options?: {
      /** 実装の `patch` / `add` / `where` に渡す認証コンテキスト */
      context?: unknown;
      ifUnchanged?: string;
    },
  ): Promise<ItemOf<TT>>;
  delete(
    key: TableKey<TT>,
    options?: { where?: WhereOf<ItemOf<TT>> },
  ): Promise<ItemOf<TT> | null>;
  /** 書き込まないItemに条件だけを付ける */
  check(key: TableKey<TT>, where: WhereOf<ItemOf<TT>>): Promise<void>;
  /** 読み取り（transactionのみ）。読んだItemは確定時に変わっていないことを確かめる */
  get(key: TableKey<TT>): Promise<ItemOf<TT> | null>;
};

export type BulkWriteItem<TT extends AnyTableConfig> = {
  key: TableKey<TT>;
  input: z.input<TT["create"]>;
};

export type TableAccessor<TT extends AnyTableConfig> = {
  /** `withToken` を指定すると、`ifUnchanged` に渡すトークンも返す（§6.4） */
  get<const S extends FieldSelectionOf<TT> | undefined = undefined>(
    key: TableKey<TT>,
    options: { fields?: S; consistentRead?: boolean; withToken: true },
  ): Promise<{ item: Selected<TT, S>; token: string } | null>;
  get<const S extends FieldSelectionOf<TT> | undefined = undefined>(
    key: TableKey<TT>,
    options?: { fields?: S; consistentRead?: boolean; withToken?: false },
  ): Promise<Selected<TT, S> | null>;
  create(key: TableKey<TT>, input: z.input<TT["create"]>): Promise<ItemOf<TT>>;
  /** `generateKey` でキーを生成して作成する（§6.2） */
  createWithGeneratedKey(
    args: GenerateArgsOf<TT>,
    input: z.input<TT["create"]>,
  ): Promise<ItemOf<TT>>;
  /** Item全体を置き換える。なければ作成する（§6.4 全体置換） */
  set(key: TableKey<TT>, input: z.input<TT["item"]>): Promise<ItemOf<TT>>;
  update(
    key: TableKey<TT>,
    patch: PatchOf<ItemOf<TT>>,
    options?: { where?: WhereOf<ItemOf<TT>>; ifUnchanged?: string },
  ): Promise<ItemOf<TT>>;
  /** 名前付きミューテーション（`createOps` の `o.mutation`）。上書き（`overrides`）も効く */
  mutate<M extends MutationDef<TT, z.ZodType, any>>(
    mutation: M,
    key: TableKey<TT>,
    params: z.input<M["params"]>,
    options?: {
      /** 実装の `patch` / `add` / `where` に渡す認証コンテキスト */
      context?: unknown;
      ifUnchanged?: string;
    },
  ): Promise<ItemOf<TT>>;
  delete(
    key: TableKey<TT>,
    options?: { where?: WhereOf<ItemOf<TT>> },
  ): Promise<ItemOf<TT> | null>;
  query<Q extends QueryDef<TT, z.ZodType, any, any>>(
    query: Q,
    params: z.input<Q["params"]>,
    options?: QueryOptions<Parameters<Q["condition"]>[1]>,
  ): Promise<QueryResult<Q["$result"]>>;
  search<S extends SearchDef<TT, z.ZodType, any, any>>(
    search: S,
    params: z.input<S["params"]>,
    /** `partition` / `filters` / `queryVector` に渡す認証コンテキスト */
    options?: { context?: unknown },
  ): Promise<S["$result"][]>;
  /**
   * 書き込んだ後は変わらないItemを、条件なしで一括して書き込む（§6.6）。
   * 変更イベントは `ADDED` として配信し、開始・終了のイベントを送る（§11.5）。
   */
  bulkWrite(options: {
    /** 書き込みの範囲（`HASH` の範囲など） */
    scope: Record<string, unknown>;
    items: Iterable<BulkWriteItem<TT>>;
  }): Promise<{ id: string; count: number }>;
  withContext(context: { runner: Runner }): RunnerAccessor<TT>;
};

export type Runner = TransactionRunner | BatchRunner;

export type RepositoryOptions<
  TTables extends Record<string, AnyTableConfig & { $createCheck: true }>,
  TContext = any,
> = {
  tables: TTables;
  dynamodb: DynamoDBClient;
  /** 物理レイアウトの名前を実際のテーブル名に読み替える（環境ごとの接頭辞など） */
  tableNames?: Record<string, string>;
  /** ページネーショントークンの署名に使う秘密の値 */
  cursorSecret?: string;
  /** 変更の受け取り手（配送実装など） */
  listener?: ChangeListener;
  /** サーバーだけで足す実装（`override()`）。同じ操作への上書きの重複はエラー */
  overrides?: readonly Override[];
  /** 受け取り手でのエラー。既定ではログに出す */
  onListenerError?: (error: unknown) => void;
  /**
   * ベクトルの実行時の設定（Table の名前ごと、ベクトルの名前ごと）。
   * スロットとフィルターを、実行時の設定（`vectorConfig`）から選ぶ関数を書く（§6.6）
   */
  vectors?: {
    [K in keyof TTables]?: {
      [V in keyof TTables[K]["vectors"]]?: VectorImpl<ItemOf<TTables[K]>>;
    };
  };
  /** ベクトル検索の実行時の設定を引く関数（§6.6） */
  resolveVectorConfig?: VectorConfigResolver;
  /** `version` の不一致による再試行の上限 */
  maxRetries?: number;
  /**
   * クエリや検索の結果に、itemのSchemaでparseできない保存データがあったときの扱い（§6.5）。
   * `"throw"`（既定）はエラーにし、`"skip"` は結果から除外する。`get` は常にエラーにする。
   */
  invalidItems?: "throw" | "skip";
};

export type Repository<
  TTables extends Record<string, AnyTableConfig & { $createCheck: true }>,
  TContext = any,
> = { [K in keyof TTables]: TableAccessor<TTables[K]> } & {
  /** 型だけの情報。登録した実装が受け取る認証コンテキスト */
  readonly $context?: TContext;
  /** 読み取りと書き込み（Firestoreのtransactionに相当） */
  runTransaction<T>(fn: (tx: TransactionRunner) => Promise<T>): Promise<T>;
  /** 書き込みだけ（Firestoreのbatchに相当） */
  createBatch(): BatchRunner;
  /** ベクトル検索の設定のキャッシュを無効にする */
  invalidateVectorConfig(): void;
  /**
   * Table定義に対応するアクセサを引く。
   * エンドポイントからRepositoryを呼ぶミドルウェアなどが使う。登録していなければ `DefinitionError`
   */
  forTable<TT extends AnyTableConfig>(table: TT): TableAccessor<TT>;
  /**
   * 共有の定義（`createOps`）の操作を実行する。入力の検証 → 認可 → 実行の順に行い、
   * 上書き（`overrides`）を合わせる。`authorize` を持つ操作では `context` が必須
   */
  execute(
    op: AnyOp,
    request: OpRequest,
    options?: ExecuteOptions,
  ): Promise<unknown>;
  /** 入力の検証と認可だけを、同期で行う（上書きを含む）。拒否は `ForbiddenError` */
  authorize(
    op: AnyOp,
    request: OpRequest,
    options?: ExecuteOptions,
  ): Record<string, unknown>;
  /**
   * 上書き（`overrides`）を作った `defineContext` の目印。上書きがなければ `undefined`。
   * `createServerApi` が、登録簿の操作と同じ `defineContext` かを確かめるのに使う
   */
  readonly overrideMark: ContextMark | undefined;
};

// ---- 内部 ----

class VersionConflict extends Error {}

type Engine = {
  client: DynamoDBClient;
  tableName(codec: EntityCodec): string;
  maxRetries: number;
  emit(changes: ChangeRecord[]): Promise<void>;
  marker(marker: BatchMarker): Promise<void>;
  cursorSecret: string | undefined;
  invalidItems: "throw" | "skip";
  resolveVectorConfig: VectorConfigResolver | undefined;
  vectorConfigCache: Map<string, Promise<VectorRuntimeConfig>>;
  /** 共有の定義に、上書きを合わせた定義を作る */
  mutation(def: MutationDef): MutationDef;
  search(def: SearchDef): SearchDef;
};

const conditionItem = (error: unknown): Raw | undefined =>
  error instanceof ConditionalCheckFailedException
    ? fromAttributes(error.Item)
    : undefined;

/**
 * `ifUnchanged` のトークンから、読んだときの version を得る（§6.4）。
 * トークンが必須の設定でトークンがなければエラーにする。
 */
const expectedVersionOf = (
  engine: Engine,
  codec: EntityCodec,
  key: unknown,
  token: string | undefined,
  mutation?: MutationDef,
): number | undefined => {
  const mode = mutation?.ifUnchanged ?? codec.table.ifUnchanged;
  if (token === undefined) {
    if (mode === "required") {
      throw new ValidationError(
        `${codec.entity}: an ifUnchanged token is required to write this item`,
      );
    }
    return undefined;
  }
  if (!engine.cursorSecret) {
    throw new TransactionError(
      "cursorSecret must be configured to use ifUnchanged",
    );
  }
  return verifyItemToken(
    engine.cursorSecret,
    codec.entity,
    codec.primaryKey(codec.parseKey(key)),
    token,
  );
};

const getRaw = async (
  engine: Engine,
  codec: EntityCodec,
  primary: Raw,
  options: {
    consistentRead?: boolean;
    projection?: string;
    ctx?: ExpressionContext;
  } = {},
): Promise<Raw | undefined> => {
  const res = await engine.client.send(
    new GetItemCommand({
      TableName: engine.tableName(codec),
      Key: toAttributes(primary),
      ConsistentRead: options.consistentRead ?? true,
      ProjectionExpression: options.projection,
      ...(options.projection ? options.ctx!.toInput() : {}),
    }),
  );
  return fromAttributes(res.Item);
};

const withRetries = async <T>(
  engine: Engine,
  fn: () => Promise<T>,
): Promise<T> => {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (!(error instanceof VersionConflict)) throw error;
      if (attempt >= engine.maxRetries) {
        throw new ConflictError(
          "the item was updated concurrently; retry limit reached",
        );
      }
      await backoff(attempt);
    }
  }
};

/** `generateKey` でキーを生成する。作成の入力を検証してから渡す */
const generatedKey = (codec: EntityCodec, args: unknown, input: unknown) => {
  const generate = codec.table.generateKey;
  if (!generate) {
    throw new DefinitionError(`${codec.entity}: generateKey is not defined`);
  }
  const parsed = validatedOr(input, (raw) => {
    const result = codec.table.create.safeParse(raw);
    if (!result.success) {
      throw new ValidationError(
        `${codec.entity}: invalid create input: ${result.error.message}`,
        result.error.issues,
      );
    }
    return result.data;
  });
  return generate.call(
    codec.table,
    args instanceof Validated ? args.value : args,
    parsed,
  );
};

const origin = (kind: WriteOrigin["kind"]): WriteOrigin => ({
  kind,
  id: randomUUID(),
});

/**
 * 部分更新を1回の `UpdateItem` で行う（§6.4）。
 * 物理キーの付け直しに足りない値があれば、強い整合性で事前に読み取り、`version` の一致を条件にする。
 */
const runUpdate = async (
  engine: Engine,
  codec: EntityCodec,
  key: unknown,
  patch: Raw,
  add: Raw | undefined,
  where: Raw | undefined,
  expectedVersion: number | undefined,
): Promise<{ before: Raw; after: Raw; beforeVersion: number }> =>
  withRetries(engine, async () => {
    const plan = planUpdate(codec, key, patch, add, where, new Date());
    let read: Raw | undefined;
    if (plan.needsRead) {
      read = await getRaw(engine, codec, plan.primary);
      if (!read) throw new ItemNotFoundError(codec.entity);
      if (
        expectedVersion !== undefined &&
        Number(read[VERSION_ATTRIBUTE]) !== expectedVersion
      ) {
        throw new StaleItemError(codec.entity);
      }
    }
    const actions = await finalizeUpdate(
      codec,
      plan,
      read ? codec.decode(read).item : undefined,
    );
    const ctx = new ExpressionContext();
    const condition = and(
      `attribute_exists(${ctx.name(codec.compiled.physical.primary.pk)})`,
      codec.whereExpression(where, ctx),
      plan.needsVersion && read
        ? `${ctx.name(VERSION_ATTRIBUTE)} = ${ctx.value(read[VERSION_ATTRIBUTE])}`
        : undefined,
      expectedVersion !== undefined
        ? `${ctx.name(VERSION_ATTRIBUTE)} = ${ctx.value(expectedVersion)}`
        : undefined,
    );
    const update = buildUpdateExpression(ctx, actions);
    let old: Raw | undefined;
    try {
      const res = await engine.client.send(
        new UpdateItemCommand({
          TableName: engine.tableName(codec),
          Key: toAttributes(plan.primary),
          UpdateExpression: update,
          ConditionExpression: condition,
          ReturnValues: "ALL_OLD",
          ReturnValuesOnConditionCheckFailure: "ALL_OLD",
          ...ctx.toInput(),
        }),
      );
      old = fromAttributes(res.Attributes);
    } catch (error) {
      if (!(error instanceof ConditionalCheckFailedException)) throw error;
      const current = conditionItem(error);
      if (!current) throw new ItemNotFoundError(codec.entity);
      if (
        expectedVersion !== undefined &&
        Number(current[VERSION_ATTRIBUTE]) !== expectedVersion
      ) {
        throw new StaleItemError(codec.entity);
      }
      if (
        plan.needsVersion &&
        read &&
        current[VERSION_ATTRIBUTE] !== read[VERSION_ATTRIBUTE]
      ) {
        throw new VersionConflict();
      }
      throw new ConditionFailedError(codec.entity);
    }
    const before = old!;
    return {
      before,
      after: applyActions(before, actions),
      beforeVersion: Number(before[VERSION_ATTRIBUTE] ?? 0),
    };
  });

class Accessor {
  constructor(
    private readonly engine: Engine,
    readonly codec: EntityCodec,
  ) {}

  private change(
    before: Raw | null,
    after: Raw | null,
    key: Raw,
    version: number,
    from: WriteOrigin,
  ): ChangeRecord {
    return {
      entity: this.codec.entity,
      key,
      before,
      after,
      version,
      origin: from,
    };
  }

  async get(
    key: unknown,
    options: {
      fields?: FieldSelection;
      consistentRead?: boolean;
      withToken?: boolean;
    } = {},
  ) {
    const parsed = this.codec.parseKey(key);
    const ctx = new ExpressionContext();
    const projection = this.codec.projection(options.fields, ctx);
    const raw = await getRaw(
      this.engine,
      this.codec,
      this.codec.primaryKey(parsed),
      {
        consistentRead: options.consistentRead,
        projection: projection.expression,
        ctx,
      },
    );
    if (!raw) return null;
    const item = projection.fields
      ? this.codec.decodeSelected(raw, projection.fields).item
      : this.codec.decode(raw).item;
    if (!options.withToken) return item;
    if (!this.engine.cursorSecret) {
      throw new TransactionError(
        "cursorSecret must be configured to use ifUnchanged",
      );
    }
    const token = signItemToken(
      this.engine.cursorSecret,
      this.codec.entity,
      this.codec.primaryKey(parsed),
      Number(raw[VERSION_ATTRIBUTE]),
    );
    return { item, token };
  }

  /** 一覧の各要素をparseする。`invalidItems: "skip"` なら、parseできない要素を除外する */
  private decodeEach<T, R>(values: readonly T[], decode: (value: T) => R): R[] {
    const out: R[] = [];
    for (const value of values) {
      try {
        out.push(decode(value));
      } catch (error) {
        if (
          this.engine.invalidItems === "skip" &&
          error instanceof CorruptedDataError
        ) {
          continue;
        }
        throw error;
      }
    }
    return out;
  }

  async createWithGeneratedKey(args: unknown, input: unknown) {
    return this.create(generatedKey(this.codec, args, input), input);
  }

  async create(key: unknown, input: unknown) {
    const { key: parsed, item } = buildCreate(
      this.codec,
      key,
      input,
      new Date(),
    );
    const stored = await this.codec.toStored(item, 1);
    const ctx = new ExpressionContext();
    try {
      await this.engine.client.send(
        new PutItemCommand({
          TableName: this.engine.tableName(this.codec),
          Item: toAttributes(stored),
          ConditionExpression: `attribute_not_exists(${ctx.name(this.codec.compiled.physical.primary.pk)})`,
          ...ctx.toInput(),
        }),
      );
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) {
        throw new ItemAlreadyExistsError(this.codec.entity);
      }
      throw error;
    }
    const after = this.codec.decode(stored).item;
    await this.engine.emit([
      this.change(null, after, parsed, 1, origin("single")),
    ]);
    return after;
  }

  /** 全体置換。1件だけのrunnerとして、読んでから `_version` の一致を条件に書く */
  async set(key: unknown, input: unknown) {
    return withRetries(this.engine, async () => {
      const state = new TransactionState(this.engine);
      const runner = new TransactionRunner(state)._bind(this.codec);
      const item = await runner.set(key as never, input as never);
      await state.commit("single");
      return item;
    });
  }

  async update(
    key: unknown,
    patch: Raw,
    options: { where?: Raw; ifUnchanged?: string } = {},
  ) {
    const expected = expectedVersionOf(
      this.engine,
      this.codec,
      key,
      options.ifUnchanged,
    );
    return (await this.write(key, patch, undefined, options.where, expected))
      .after;
  }

  async mutate(
    contract: MutationDef,
    key: unknown,
    params: unknown,
    options: { context?: unknown; ifUnchanged?: string } = {},
  ) {
    const mutation = this.engine.mutation(contract);
    const expected = expectedVersionOf(
      this.engine,
      this.codec,
      key,
      options.ifUnchanged,
      mutation,
    );
    const p = validatedOr(params, (raw) => mutation.params.parse(raw));
    // 上書きの patch / where は非同期でもよい
    const patch = ((await mutation.patch?.(p, options.context)) ?? {}) as Raw;
    const add = mutation.add?.(p, options.context) as Raw | undefined;
    const where = (await mutation.where?.(p, options.context)) as
      Raw | undefined;
    return (await this.write(key, patch, add, where, expected)).after;
  }

  private async write(
    key: unknown,
    patch: Raw,
    add: Raw | undefined,
    where: Raw | undefined,
    expectedVersion: number | undefined,
  ) {
    const { before, after, beforeVersion } = await runUpdate(
      this.engine,
      this.codec,
      key,
      patch,
      add,
      where,
      expectedVersion,
    );
    const b = this.codec.decode(before).item;
    const a = this.codec.decode(after).item;
    await this.engine.emit([
      this.change(
        b,
        a,
        this.codec.keyOf(a),
        beforeVersion + 1,
        origin("single"),
      ),
    ]);
    return { before: b, after: a };
  }

  async delete(key: unknown, options: { where?: Raw } = {}) {
    return this.deleteItem(this.codec.parseKey(key), options.where);
  }

  private async deleteItem(parsed: Raw, where: Raw | undefined) {
    const ctx = new ExpressionContext();
    const whereExpr = this.codec.whereExpression(where, ctx);
    const condition = whereExpr
      ? and(
          `attribute_exists(${ctx.name(this.codec.compiled.physical.primary.pk)})`,
          whereExpr,
        )
      : undefined;
    let old: Raw | undefined;
    try {
      const res = await this.engine.client.send(
        new DeleteItemCommand({
          TableName: this.engine.tableName(this.codec),
          Key: toAttributes(this.codec.primaryKey(parsed)),
          ConditionExpression: condition,
          ReturnValues: "ALL_OLD",
          ReturnValuesOnConditionCheckFailure: "ALL_OLD",
          ...ctx.toInput(),
        }),
      );
      old = fromAttributes(res.Attributes);
    } catch (error) {
      if (!(error instanceof ConditionalCheckFailedException)) throw error;
      if (!conditionItem(error)) throw new ItemNotFoundError(this.codec.entity);
      throw new ConditionFailedError(this.codec.entity);
    }
    if (!old) return null;
    const before = this.codec.decode(old);
    await this.engine.emit([
      this.change(
        before.item,
        null,
        parsed,
        before.version + 1,
        origin("single"),
      ),
    ]);
    return before.item;
  }

  async query(
    query: QueryDef,
    params: unknown,
    options: QueryOptions<unknown> = {},
  ) {
    if (query.table._compiled.entity !== this.codec.entity) {
      throw new DefinitionError(
        `query "${query.name}" belongs to another entity`,
      );
    }
    const p = validatedOr(params, (raw) => query.params.parse(raw));
    const cond = query.condition(p, options.context);
    const physical =
      cond.indexName === undefined
        ? this.codec.compiled.physical.primary
        : this.codec.compiled.indexes.get(cond.indexName)!.physical;
    const projection =
      cond.indexName === undefined
        ? "ALL"
        : this.codec.compiled.indexes.get(cond.indexName)!.physical.projection;
    const ctx = new ExpressionContext();
    const pk = ctx.name(physical.pk);
    const sk = ctx.name(physical.sk);
    let skExpr: string | undefined;
    switch (cond.sk?.op) {
      case "eq":
        skExpr = `${sk} = ${ctx.value(cond.sk.value)}`;
        break;
      case "beginsWith":
        skExpr = `begins_with(${sk}, ${ctx.value(cond.sk.value)})`;
        break;
      case "between":
        skExpr = `${sk} BETWEEN ${ctx.value(cond.sk.low)} AND ${ctx.value(cond.sk.high)}`;
        break;
      case "lt":
        skExpr = `${sk} < ${ctx.value(cond.sk.value)}`;
        break;
    }
    const queryName = `${this.codec.entity}${SEPARATOR}${query.name}`;
    // トークンは計算したキー条件に結び付ける。ctx を含む条件が変われば使えない（§7.6）
    const binding = { slot: cond.slot, pk: cond.pk, sk: cond.sk };
    let startKey: Record<string, AttributeValue> | undefined;
    if (options.cursor) {
      if (!this.engine.cursorSecret) {
        throw new InvalidCursorError("cursorSecret is not configured");
      }
      startKey = verifyCursor(
        this.engine.cursorSecret,
        queryName,
        binding,
        options.cursor,
      );
    }
    const res = await this.engine.client.send(
      new QueryCommand({
        TableName: this.engine.tableName(this.codec),
        IndexName: cond.slot,
        KeyConditionExpression: and(`${pk} = ${ctx.value(cond.pk)}`, skExpr),
        ScanIndexForward: query.direction === "asc",
        Limit: options.limit ?? query.limit,
        ExclusiveStartKey: startKey,
        ...ctx.toInput(),
      }),
    );
    const raws = (res.Items ?? []).map((i) => fromAttributes(i)!);
    let entries: { item: Raw; version: number }[];
    if (projection === "ALL") {
      entries = this.decodeEach(raws, (r) => this.codec.decode(r));
    } else if (query.select === "projection" && !options.withVersions) {
      entries = this.decodeEach(raws, (r) => ({
        item: this.codec.decodeProjection(r, cond.indexName),
        version: 0,
      }));
    } else {
      // 本体を強い整合性で読み、GSIの遅れで条件に合わなくなったItemは除外する（§6.3）
      const primary = this.codec.compiled.physical.primary;
      const bodies = await batchGet(
        this.engine.client,
        this.engine.tableName(this.codec),
        primary,
        raws,
      );
      const found = raws
        .map((r) => lookupBatchGet(bodies, primary, r))
        .filter((b): b is Raw => !!b);
      // version は、同じ読み取りで得た内容と組にする（GSIの射影は本体より古いことがある）
      entries = this.decodeEach(found, (b) => this.codec.decode(b)).filter(
        (e) => query.matches(e.item, p, options.context),
      );
    }
    const items = entries.map((e) => e.item);
    let nextCursor: string | undefined;
    if (res.LastEvaluatedKey) {
      if (!this.engine.cursorSecret) {
        throw new InvalidCursorError(
          "cursorSecret must be configured to paginate queries",
        );
      }
      nextCursor = signCursor(
        this.engine.cursorSecret,
        queryName,
        binding,
        res.LastEvaluatedKey,
      );
    }
    return {
      items,
      ...(nextCursor ? { cursor: nextCursor } : {}),
      ...(options.withVersions
        ? { versions: entries.map((e) => e.version) }
        : {}),
    };
  }

  async vectorConfig(vector: CompiledVector, partition: Raw, hash: string) {
    const resolver = this.engine.resolveVectorConfig;
    if (!resolver) {
      throw new DefinitionError(
        `${this.codec.entity}: vector "${vector.name}" needs resolveVectorConfig`,
      );
    }
    const cacheKey = `${this.codec.entity}\u0000${vector.name}\u0000${hash}`;
    let cached = this.engine.vectorConfigCache.get(cacheKey);
    if (!cached) {
      cached = Promise.resolve(
        resolver({
          entity: this.codec.entity,
          vector: vector.name,
          partition,
          hash,
        }),
      );
      cached.catch(() => this.engine.vectorConfigCache.delete(cacheKey));
      this.engine.vectorConfigCache.set(cacheKey, cached);
    }
    return cached;
  }

  async search(
    contract: SearchDef,
    params: unknown,
    options: { context?: unknown } = {},
  ) {
    const search = this.engine.search(contract);
    const vector = this.codec.compiled.vectors.get(search.vector)!;
    const p = validatedOr(params, (raw) => search.params.parse(raw));
    const partition = search.partition!(p, options.context);
    const hash = composeKey(this.codec.entity, vector.partition, partition);
    if (hash === undefined) {
      throw new ValidationError(
        "all partition fields of the vector must be specified",
      );
    }
    const vectorConfig = vector.dynamic
      ? await this.vectorConfig(vector, partition, hash)
      : undefined;
    const ctx = { ...(options.context as object), vectorConfig };
    const slotName =
      typeof vector.slot === "string"
        ? vector.slot
        : vector.slot(partition, { vectorConfig: vectorConfig! });
    const slot = this.codec.compiled.physical.vectorIndexes[slotName];
    if (!slot) throw new DefinitionError(`unknown vector slot "${slotName}"`);
    const queryVector = await search.queryVector!(p, ctx);
    if (queryVector.length !== slot.dimensions) {
      throw new ValidationError(
        `query vector must have ${slot.dimensions} dimensions`,
      );
    }
    const expr = new ExpressionContext();
    const conditions = [`${expr.name(slot.hash)} = ${expr.value(hash)}`];
    for (const [attr, value] of Object.entries(
      search.filters?.(p, ctx) ?? {},
    )) {
      if (value === undefined) continue;
      if (!slot.filters.includes(attr)) {
        throw new ValidationError(
          `slot "${slotName}" has no filter attribute "${attr}"`,
        );
      }
      let encoded: string | undefined;
      if (typeof value === "string") {
        encoded = value;
      } else if (vector.filters.kind === "static") {
        const spec = vector.filters.spec[attr];
        if (!spec) throw new ValidationError(`filter "${attr}" is not defined`);
        encoded = this.codec.staticFilters(
          { ...vector, filters: { kind: "static", spec: { [attr]: spec } } },
          value,
        )[attr];
      } else {
        const spec = vectorConfig?.filters?.[attr];
        if (!spec)
          throw new ValidationError(`filter "${attr}" is not configured`);
        encoded = buildFilters({ [attr]: spec }, value)[attr];
      }
      if (encoded !== undefined) {
        conditions.push(`${expr.name(attr)} = ${expr.value(encoded)}`);
      }
    }
    const res = await this.engine.client.send(
      new SearchVectorsCommand({
        TableName: this.engine.tableName(this.codec),
        IndexName: slotName,
        SearchVector: queryVector.map((n) => marshallValue(n)),
        SearchConditionExpression: conditions.join(" AND "),
        TopK: search.topK,
        ...expr.toInput(),
      }),
    );
    const results = (res.SearchResults ?? []).map((r) => ({
      raw: fromAttributes(r.Item) ?? {},
      score: r.Score ?? 0,
    }));
    if (slot.projection === "ALL" || search.select === "projection") {
      return this.decodeEach(results, ({ raw, score }) => ({
        item:
          slot.projection === "ALL"
            ? this.codec.decode(raw).item
            : this.codec.decodeProjection(raw, undefined),
        score,
      }));
    }
    const primary = this.codec.compiled.physical.primary;
    const bodies = await batchGet(
      this.engine.client,
      this.engine.tableName(this.codec),
      primary,
      results.map((r) => r.raw),
    );
    const found = results.flatMap(({ raw, score }) => {
      const body = lookupBatchGet(bodies, primary, raw);
      return body ? [{ body, score }] : [];
    });
    return this.decodeEach(found, ({ body, score }) => ({
      item: this.codec.decode(body).item,
      score,
    }));
  }

  async bulkWrite(options: {
    scope: Raw;
    items: Iterable<{ key: unknown; input: unknown }>;
  }) {
    const from = origin("batch");
    const now = new Date();
    const prepared: { key: Raw; stored: Raw }[] = [];
    for (const { key, input } of options.items) {
      const built = buildCreate(this.codec, key, input, now);
      prepared.push({
        key: built.key,
        stored: await this.codec.toStored(built.item, 1),
      });
    }
    await this.engine.marker({
      type: "BATCH_STARTED",
      origin: from,
      entity: this.codec.entity,
      scope: options.scope,
    });
    let count = 0;
    try {
      await batchWrite(
        this.engine.client,
        this.engine.tableName(this.codec),
        prepared.map(({ stored }) => ({
          PutRequest: { Item: toAttributes(stored) },
        })),
        async (n) => {
          const written = prepared.slice(count, count + n);
          count += n;
          await this.engine.emit(
            written.map(({ key, stored }) =>
              this.change(null, this.codec.decode(stored).item, key, 1, from),
            ),
          );
        },
      );
    } catch (error) {
      await this.engine.marker({
        type: "BATCH_FINISHED",
        origin: from,
        entity: this.codec.entity,
        scope: options.scope,
        count,
        status: "aborted",
      });
      throw error;
    }
    await this.engine.marker({
      type: "BATCH_FINISHED",
      origin: from,
      entity: this.codec.entity,
      scope: options.scope,
      count,
      status: "completed",
    });
    return { id: from.id, count };
  }

  withContext(context: { runner: Runner }) {
    return context.runner._bind(this.codec);
  }
}

// ---- runner ----

type ReadRecord = { codec: EntityCodec; primary: Raw; raw: Raw | undefined };

type WriteMeta = {
  codec: EntityCodec;
  key: Raw;
  identity: string;
  /** 条件の種類。失敗の理由を区別するのに使う */
  conditionKind: "create" | "version" | "where" | "check" | "read";
  expectedVersion: number | undefined;
  before: Raw | null;
  after: Raw | null;
  version: number;
  changed: boolean;
};

/** 書き込みをためておき、最後に1回の `TransactWriteItems` として確定する */
class TransactionState {
  readonly reads = new Map<string, ReadRecord>();
  readonly items: TransactWriteItem[] = [];
  readonly metas: WriteMeta[] = [];
  private readonly written = new Set<string>();

  constructor(readonly engine: Engine) {}

  /** 強い整合性で読む。同じItemはトランザクションの中で一度だけ読む */
  async read(codec: EntityCodec, primary: Raw): Promise<Raw | undefined> {
    const id = codec.identity(primary);
    const cached = this.reads.get(id);
    if (cached) return cached.raw;
    if (this.written.has(id)) {
      // 読み取りは書き込みより前に行う（§6.4 トランザクション）
      throw new TransactionError(
        `${codec.entity}: an item cannot be read after it is written in the same transaction`,
      );
    }
    const raw = await getRaw(this.engine, codec, primary);
    this.reads.set(id, { codec, primary, raw });
    return raw;
  }

  /** このトランザクションで読んだItem（読んでいなければ `undefined`） */
  recorded(codec: EntityCodec, primary: Raw): ReadRecord | undefined {
    return this.reads.get(codec.identity(primary));
  }

  private claim(codec: EntityCodec, primary: Raw) {
    const id = codec.identity(primary);
    if (this.written.has(id)) {
      throw new TransactionError(
        `${codec.entity}: the same item cannot be written twice in one transaction`,
      );
    }
    this.written.add(id);
    if (this.items.length >= MAX_TRANSACTION_ITEMS) {
      throw new TransactionError(
        `a transaction can include at most ${MAX_TRANSACTION_ITEMS} items`,
      );
    }
    return id;
  }

  versionCondition(
    ctx: ExpressionContext,
    codec: EntityCodec,
    raw: Raw | undefined,
  ) {
    return raw
      ? `${ctx.name(VERSION_ATTRIBUTE)} = ${ctx.value(raw[VERSION_ATTRIBUTE])}`
      : `attribute_not_exists(${ctx.name(codec.compiled.physical.primary.pk)})`;
  }

  push(
    item: TransactWriteItem,
    meta: Omit<WriteMeta, "identity">,
    primary: Raw,
  ) {
    const identity = this.claim(meta.codec, primary);
    this.items.push(item);
    this.metas.push({ ...meta, identity });
  }

  async commit(kind: WriteOrigin["kind"]): Promise<void> {
    // 読んだだけのItemは、変わっていないことを確かめる
    for (const [id, read] of this.reads) {
      if (this.written.has(id)) continue;
      const ctx = new ExpressionContext();
      const item: TransactWriteItem = {
        ConditionCheck: {
          TableName: this.engine.tableName(read.codec),
          Key: toAttributes(read.primary),
          ConditionExpression: this.versionCondition(ctx, read.codec, read.raw),
          ReturnValuesOnConditionCheckFailure: "ALL_OLD",
          ...ctx.toInput(),
        },
      };
      this.push(
        item,
        {
          codec: read.codec,
          key: {},
          conditionKind: "read",
          expectedVersion: read.raw
            ? Number(read.raw[VERSION_ATTRIBUTE])
            : undefined,
          before: null,
          after: null,
          version: 0,
          changed: false,
        },
        read.primary,
      );
    }
    if (this.items.length === 0) return;
    try {
      await this.engine.client.send(
        new TransactWriteItemsCommand({ TransactItems: this.items }),
      );
    } catch (error) {
      if (!(error instanceof TransactionCanceledException)) throw error;
      const reasons = error.CancellationReasons ?? [];
      let conflict = false;
      for (let i = 0; i < reasons.length; i++) {
        const reason = reasons[i]!;
        const meta = this.metas[i]!;
        if (reason.Code === "TransactionConflict") conflict = true;
        if (reason.Code !== "ConditionalCheckFailed") continue;
        const current = fromAttributes(reason.Item);
        const currentVersion = current
          ? Number(current[VERSION_ATTRIBUTE])
          : undefined;
        switch (meta.conditionKind) {
          case "create":
            throw new ItemAlreadyExistsError(meta.codec.entity);
          case "check":
            if (!current) throw new ItemNotFoundError(meta.codec.entity);
            throw new ConditionFailedError(meta.codec.entity);
          case "read":
          case "version":
            if (currentVersion !== meta.expectedVersion) {
              conflict = true;
              break;
            }
            throw new ConditionFailedError(meta.codec.entity);
          case "where":
            if (currentVersion !== meta.expectedVersion) {
              conflict = true;
              break;
            }
            throw new ConditionFailedError(meta.codec.entity);
        }
      }
      if (conflict) throw new VersionConflict();
      throw error;
    }
    const from = origin(kind);
    const changes = this.metas
      .filter((m) => m.changed)
      .map((m): ChangeRecord => ({
        entity: m.codec.entity,
        key: m.key,
        before: m.before,
        after: m.after,
        version: m.version,
        origin: from,
      }));
    await this.engine.emit(changes);
  }
}

/** runnerに結び付けたアクセサの実装 */
const bindAccessor = (
  getState: () => TransactionState,
  codec: EntityCodec,
  mode: "transaction" | "batch",
  enqueue: (
    op: (state: TransactionState) => Promise<unknown>,
  ) => Promise<unknown>,
) => {
  const tableName = () => getState().engine.tableName(codec);
  const primaryPk = codec.compiled.physical.primary.pk;

  const create = (key: unknown, input: unknown) =>
    enqueue(async (state) => {
      const { key: parsed, item } = buildCreate(codec, key, input, new Date());
      const stored = await codec.toStored(item, 1);
      const ctx = new ExpressionContext();
      state.push(
        {
          Put: {
            TableName: tableName(),
            Item: toAttributes(stored),
            ConditionExpression: `attribute_not_exists(${ctx.name(primaryPk)})`,
            ...ctx.toInput(),
          },
        },
        {
          codec,
          key: parsed,
          conditionKind: "create",
          expectedVersion: undefined,
          before: null,
          after: codec.decode(stored).item,
          version: 1,
          changed: true,
        },
        codec.primaryKey(parsed),
      );
      return codec.decode(stored).item;
    });

  const set = (key: unknown, input: unknown) =>
    enqueue(async (state) => {
      const { key: parsed, item } = buildSet(codec, key, input, new Date());
      const primary = codec.primaryKey(parsed);
      const raw = await state.read(codec, primary);
      const version = raw ? Number(raw[VERSION_ATTRIBUTE]) + 1 : 1;
      const stored = await codec.toStored(item, version);
      const ctx = new ExpressionContext();
      state.push(
        {
          Put: {
            TableName: tableName(),
            Item: toAttributes(stored),
            ConditionExpression: state.versionCondition(ctx, codec, raw),
            ReturnValuesOnConditionCheckFailure: "ALL_OLD",
            ...ctx.toInput(),
          },
        },
        {
          codec,
          key: parsed,
          conditionKind: "version",
          expectedVersion: raw ? Number(raw[VERSION_ATTRIBUTE]) : undefined,
          before: raw ? codec.decode(raw).item : null,
          after: codec.decode(stored).item,
          version,
          changed: true,
        },
        primary,
      );
      return codec.decode(stored).item;
    });

  const write = (
    key: unknown,
    patch: Raw,
    add: Raw | undefined,
    where: Raw | undefined,
    token: string | undefined,
    mutation?: MutationDef,
  ) => {
    const expected = expectedVersionOf(
      getState().engine,
      codec,
      key,
      token,
      mutation,
    );
    return enqueue(async (state) => {
      const plan: UpdatePlan = planUpdate(
        codec,
        key,
        patch,
        add,
        where,
        new Date(),
      );
      const raw = await state.read(codec, plan.primary);
      if (!raw) throw new ItemNotFoundError(codec.entity);
      if (
        expected !== undefined &&
        Number(raw[VERSION_ATTRIBUTE]) !== expected
      ) {
        throw new StaleItemError(codec.entity);
      }
      const before = codec.decode(raw);
      const actions: UpdateActions = await finalizeUpdate(
        codec,
        plan,
        before.item,
      );
      const ctx = new ExpressionContext();
      const whereExpr = codec.whereExpression(where, ctx);
      const update = buildUpdateExpression(ctx, actions);
      state.push(
        {
          Update: {
            TableName: tableName(),
            Key: toAttributes(plan.primary),
            UpdateExpression: update,
            ConditionExpression: and(
              state.versionCondition(ctx, codec, raw),
              whereExpr,
            ),
            ReturnValuesOnConditionCheckFailure: "ALL_OLD",
            ...ctx.toInput(),
          },
        },
        {
          codec,
          key: plan.key,
          conditionKind: whereExpr ? "where" : "version",
          expectedVersion: before.version,
          before: before.item,
          after: codec.decode(applyActions(raw, actions)).item,
          version: before.version + 1,
          changed: true,
        },
        plan.primary,
      );
      return codec.decode(applyActions(raw, actions)).item;
    });
  };

  const remove = (key: unknown, options: { where?: Raw } = {}) =>
    enqueue(async (state) => {
      const parsed = codec.parseKey(key);
      const primary = codec.primaryKey(parsed);
      const raw = await state.read(codec, primary);
      const ctx = new ExpressionContext();
      const whereExpr = codec.whereExpression(options.where, ctx);
      if (!raw && whereExpr) throw new ItemNotFoundError(codec.entity);
      const before = raw ? codec.decode(raw) : undefined;
      state.push(
        {
          Delete: {
            TableName: tableName(),
            Key: toAttributes(primary),
            ConditionExpression: and(
              state.versionCondition(ctx, codec, raw),
              whereExpr,
            ),
            ReturnValuesOnConditionCheckFailure: "ALL_OLD",
            ...ctx.toInput(),
          },
        },
        {
          codec,
          key: parsed,
          conditionKind: whereExpr ? "where" : "version",
          expectedVersion: before?.version,
          before: before?.item ?? null,
          after: null,
          version: (before?.version ?? 0) + 1,
          changed: !!before,
        },
        primary,
      );
      return before?.item ?? null;
    });

  const check = (key: unknown, where: Raw) =>
    enqueue(async (state) => {
      const parsed = codec.parseKey(key);
      const primary = codec.primaryKey(parsed);
      const ctx = new ExpressionContext();
      // 同じItemを読んでいれば、読んだ後に変わっていないことも同じ条件で確かめる
      const read = state.recorded(codec, primary);
      state.push(
        {
          ConditionCheck: {
            TableName: tableName(),
            Key: toAttributes(primary),
            ConditionExpression: and(
              `attribute_exists(${ctx.name(primaryPk)})`,
              codec.whereExpression(where, ctx),
              read ? state.versionCondition(ctx, codec, read.raw) : undefined,
            )!,
            ReturnValuesOnConditionCheckFailure: "ALL_OLD",
            ...ctx.toInput(),
          },
        },
        {
          codec,
          key: parsed,
          conditionKind: read ? "where" : "check",
          expectedVersion: read?.raw
            ? Number(read.raw[VERSION_ATTRIBUTE])
            : undefined,
          before: null,
          after: null,
          version: 0,
          changed: false,
        },
        primary,
      );
    });

  return {
    create,
    createWithGeneratedKey: (args: unknown, input: unknown) =>
      create(generatedKey(codec, args, input), input),
    set,
    update: (
      key: unknown,
      patch: Raw,
      options: { where?: Raw; ifUnchanged?: string } = {},
    ) => write(key, patch, undefined, options.where, options.ifUnchanged),
    mutate: async (
      contract: MutationDef,
      key: unknown,
      params: unknown,
      options: { context?: unknown; ifUnchanged?: string } = {},
    ) => {
      const mutation = getState().engine.mutation(contract);
      const p = validatedOr(params, (raw) => mutation.params.parse(raw));
      // 上書きの patch / where は非同期でもよい
      const patch = ((await mutation.patch?.(p, options.context)) ?? {}) as Raw;
      const where = (await mutation.where?.(p, options.context)) as
        Raw | undefined;
      return write(
        key,
        patch,
        mutation.add?.(p, options.context) as Raw | undefined,
        where,
        options.ifUnchanged,
        mutation,
      );
    },
    delete: remove,
    check,
    get: async (key: unknown) => {
      if (mode !== "transaction") {
        throw new TransactionError("get is only available in runTransaction");
      }
      const parsed = codec.parseKey(key);
      const raw = await getState().read(codec, codec.primaryKey(parsed));
      return raw ? codec.decode(raw).item : null;
    },
  };
};

/** `runTransaction` に渡される実行単位 */
export class TransactionRunner {
  readonly kind = "transaction" as const;
  /** @internal */
  constructor(private readonly state: TransactionState) {}
  /** @internal */
  _bind(codec: EntityCodec): RunnerAccessor<any> {
    return bindAccessor(
      () => this.state,
      codec,
      "transaction",
      (op) => op(this.state),
    ) as never;
  }
}

/** `createBatch` で作る、書き込みだけの実行単位 */
export class BatchRunner {
  readonly kind = "batch" as const;
  private readonly ops: ((state: TransactionState) => Promise<unknown>)[] = [];
  private state: TransactionState | undefined;
  private committed = false;
  /** @internal */
  constructor(private readonly engine: Engine) {}
  /** @internal */
  _bind(codec: EntityCodec): RunnerAccessor<any> {
    return bindAccessor(
      () => this.state ?? new TransactionState(this.engine),
      codec,
      "batch",
      async (op) => {
        if (this.committed)
          throw new TransactionError("the batch is already committed");
        this.ops.push(op);
        return undefined;
      },
    ) as never;
  }

  /** ためた書き込みを確定する。競合したときは読み直して再試行する */
  async commit(): Promise<void> {
    if (this.committed)
      throw new TransactionError("the batch is already committed");
    this.committed = true;
    await withRetries(this.engine, async () => {
      this.state = new TransactionState(this.engine);
      for (const op of this.ops) await op(this.state);
      await this.state.commit("transaction");
    });
  }
}

/** 1つのエンティティに1つのTable定義（§5.3） */
const checkEntities = (codecs: EntityCodec[]) => {
  const seen = new Set<string>();
  for (const codec of codecs) {
    const id = `${codec.tableName}\u0000${codec.entity}`;
    if (seen.has(id)) {
      throw new DefinitionError(
        `entity "${codec.entity}" has more than one table definition`,
      );
    }
    seen.add(id);
  }
};

/**
 * Table定義からRepositoryを作る（§6.2）。
 */
export const createRepository = <
  TTables extends Record<string, AnyTableConfig & { $createCheck: true }>,
  TContext = any,
>(
  options: RepositoryOptions<TTables, TContext>,
): Repository<TTables, TContext> => {
  const vectorConfigCache = new Map<string, Promise<VectorRuntimeConfig>>();
  const overrides: ReadonlyMap<AnyOp, OverrideImpl<any, any>> = overrideMap(
    options.overrides,
  );
  const overrideMark = options.overrides?.[0]?.mark;
  const engine: Engine = {
    client: options.dynamodb,
    tableName: (codec) =>
      options.tableNames?.[codec.tableName] ?? codec.tableName,
    maxRetries: options.maxRetries ?? DEFAULT_MAX_RETRIES,
    cursorSecret: options.cursorSecret,
    invalidItems: options.invalidItems ?? "throw",
    resolveVectorConfig: options.resolveVectorConfig,
    vectorConfigCache,
    mutation: (def: MutationDef) => {
      if (!isOp(def)) {
        throw new DefinitionError(
          `mutation "${def.name}" must be made by createOps`,
        );
      }
      return effectiveMutation(def, overrides.get(def as AnyOp));
    },
    search: (def: SearchDef) => {
      if (!isOp(def)) {
        throw new DefinitionError(
          `search "${def.name}" must be made by createOps`,
        );
      }
      return effectiveSearch(def, overrides.get(def as AnyOp));
    },
    emit: async (changes) => {
      if (changes.length === 0 || !options.listener?.onChanges) return;
      try {
        await options.listener.onChanges(changes);
      } catch (error) {
        // 書き込みは成功している。欠落は version と再同期で回復する（§11.3）
        (options.onListenerError ?? console.error)(error);
      }
    },
    marker: async (marker) => {
      if (!options.listener?.onBatchMarker) return;
      try {
        await options.listener.onBatchMarker(marker);
      } catch (error) {
        (options.onListenerError ?? console.error)(error);
      }
    },
  };
  const accessors: Record<string, Accessor> = {};
  const codecs: EntityCodec[] = [];
  for (const name of Object.keys(options.vectors ?? {})) {
    if (!(name in options.tables)) {
      throw new DefinitionError(`vectors: unknown table "${name}"`);
    }
  }
  for (const [name, contract] of Object.entries(options.tables)) {
    // ベクトルの実行時の設定（スロットとフィルターを選ぶ関数）を合わせる
    const runtime = options.vectors?.[name];
    const table = runtime ? withVectorRuntime(contract, runtime) : contract;
    // eslint-disable-next-line prefer-const -- codec と相互に参照する
    let accessor: Accessor | undefined;
    const codec = new EntityCodec(table, (vector, partition, hash) =>
      accessor!.vectorConfig(vector, partition, hash),
    );
    accessor = new Accessor(engine, codec);
    accessors[name] = accessor;
    codecs.push(codec);
  }
  checkEntities(codecs);
  const tableId = (t: AnyTableConfig) =>
    `${t.table.name}${SEPARATOR}${t.entity}`;
  const byTable = new Map<string, Accessor>();
  for (const [name, table] of Object.entries(options.tables)) {
    byTable.set(tableId(table), accessors[name]!);
  }

  const runTransaction = async <T>(
    fn: (tx: TransactionRunner) => Promise<T>,
  ): Promise<T> =>
    withRetries(engine, async () => {
      const state = new TransactionState(engine);
      const result = await fn(new TransactionRunner(state));
      await state.commit("transaction");
      return result;
    });

  const forTable = (table: AnyTableConfig) => {
    const accessor = byTable.get(tableId(table));
    if (!accessor) {
      throw new DefinitionError(
        `entity "${table.entity}" is not registered in createRepository`,
      );
    }
    return accessor;
  };
  return {
    overrideMark,
    ...accessors,
    runTransaction,
    createBatch: () => new BatchRunner(engine),
    invalidateVectorConfig: () => vectorConfigCache.clear(),
    forTable,
    authorize: (
      op: AnyOp,
      request: OpRequest,
      authorizeOptions?: ExecuteOptions,
    ) => authorizeOp(overrides, op, request, authorizeOptions),
    execute: (op: AnyOp, request: OpRequest, executeOptions?: ExecuteOptions) =>
      executeOp(
        forTable(op.table) as never,
        overrides,
        op,
        request,
        executeOptions,
      ),
  } as unknown as Repository<TTables, TContext>;
};

export { CorruptedDataError };
