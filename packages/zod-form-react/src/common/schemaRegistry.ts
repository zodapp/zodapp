/* eslint-disable @typescript-eslint/no-explicit-any */
import { msgKey } from "@zodapp/i18n-messages";
import { zodMsgKeyErrorMap } from "@zodapp/i18n-messages-zod";
import "../messages/types";
import type { AnyFormApi, StandardSchemaV1 } from "@tanstack/react-form";
import type { z } from "zod";
import { getDefaultValue } from "@zodapp/zod-form";
import { isEqualValue } from "../utils/equal";
import {
  getValueAt,
  normalizeIssuePath,
  parseFieldPath,
  pathStartsWith,
  type PathSegment,
} from "../utils/path";

/**
 * 実行時に決まった schema の登録。dynamic が path ×入れ子の深さごとに置く。
 *
 * - resolved: resolve が返した schema
 * - pending: 取り直し中。送信を止める（欄のエラーとしては表示しない）
 * - error: 取得に失敗した。送信を止め、retry で取り直せる
 */
export type RegisteredSchema =
  | { status: "resolved"; schema: z.ZodTypeAny }
  | { status: "pending" }
  | { status: "error"; error: unknown; retry: () => void };

/** 値の変更の出どころ */
export type EditCause = "user" | "external";

/** 取り直し中の path に付ける issue の印。部品はこの issue をエラーとして表示しない */
export const PENDING_ISSUE_CODE = "zodform_pending";
/** 取得に失敗した path に付ける issue の印 */
export const RESOLVE_ERROR_ISSUE_CODE = "zodform_resolve_error";

type Issue = {
  message: string;
  path: PropertyKey[];
  code?: string;
  /** zod の issue のほかの欄（invalid_union の errors など）は、そのまま残す */
  [key: string]: unknown;
};

const isThenable = (value: unknown): value is PromiseLike<unknown> =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as { then?: unknown }).then === "function";

/** issue が「読み込み中」の印か（欄のエラーとしては表示しない） */
export const isPendingIssue = (issue: unknown): boolean =>
  typeof issue === "object" &&
  issue !== null &&
  (issue as { code?: unknown }).code === PENDING_ISSUE_CODE;

/**
 * issue が invalid_union か。union の部品だけが読み、ほかの部品の欄のエラーとしては表示しない
 * （union の部品が、選んだ腕のエラーを同じ欄に足す）。パッケージの外には出さない
 */
export const isUnionIssue = (issue: unknown): boolean =>
  typeof issue === "object" &&
  issue !== null &&
  (issue as { code?: unknown }).code === "invalid_union";

/** issue が unrecognized_keys か */
export const isUnrecognizedKeysIssue = (issue: unknown): boolean =>
  typeof issue === "object" &&
  issue !== null &&
  (issue as { code?: unknown }).code === "unrecognized_keys";

/** union が同じ欄に書いた issue の、書いた union の writer（無ければ undefined） */
export const writtenByOf = (issue: unknown): object | undefined => {
  if (typeof issue !== "object" || issue === null) return undefined;
  const writtenBy = (issue as { writtenBy?: unknown }).writtenBy;
  return typeof writtenBy === "object" && writtenBy !== null
    ? writtenBy
    : undefined;
};

/**
 * 欄の issue を、この部品が出すか。
 *
 * - union が解釈するもの（invalid_union と、union の腕の unrecognized_keys）：出さない
 *   （union の部品が読む）。unrecognized_keys は、`errorToken` を受け取った部品（union の腕）のときだけ
 * - それ以外（union が書いた `writtenBy` 付きのものを含む）：`hideError` でなければ出す
 *   （同じ欄のいちばん外側の部品が出す）
 *
 * 読み込み中の印は出さない
 */
export const isDisplayedIssue = (
  issue: unknown,
  options: { hideError?: boolean; errorToken?: object },
): boolean => {
  if (isPendingIssue(issue) || isUnionIssue(issue)) return false;
  if (
    options.errorToken &&
    isUnrecognizedKeysIssue(issue) &&
    writtenByOf(issue) === undefined
  ) {
    return false;
  }
  return !options.hideError;
};

/** path ごとに覚えておく、補った結果の数 */
const FILL_CACHE_SIZE = 4;

/**
 * value の segments の位置を fill で補った値を返す（元の値は変えない）。
 * 途中の object・配列が無ければ（配列の範囲の外を含む）、value をそのまま返す
 */
const fillAt = (
  value: unknown,
  segments: readonly PathSegment[],
  fill: (value: unknown) => unknown,
): unknown => {
  if (segments.length === 0) return fill(value);
  if (typeof value !== "object" || value === null) return value;
  const [head, ...rest] = segments as [PathSegment, ...PathSegment[]];
  if (Array.isArray(value)) {
    if (typeof head !== "number" || head < 0 || head >= value.length) {
      return value;
    }
    const next = fillAt(value[head], rest, fill);
    if (next === value[head]) return value;
    const copy = value.slice();
    copy[head] = next;
    return copy;
  }
  const record = value as Record<PropertyKey, unknown>;
  const child = record[head];
  if (rest.length > 0 && (typeof child !== "object" || child === null)) {
    return value;
  }
  const next = fillAt(child, rest, fill);
  if (next === child) return value;
  return { ...record, [head]: next };
};

/**
 * record のキーの検査のエラー（invalid_key）を、値の欄ではなくキーの側（record の欄）に出すため、
 * path を record の path にする。どのキーかは `key` に、文言はキーの検査の文言（中の issue）にする。
 * record の部品は `key` を見て、そのキーの欄（entries）に出すか、record の欄に出す
 */
const moveInvalidKeyIssue = (issue: Issue): Issue => {
  const raw = issue as Issue & {
    code?: string;
    issues?: { message?: string }[];
  };
  if (raw.code !== "invalid_key" || issue.path.length === 0) return issue;
  const key = issue.path[issue.path.length - 1];
  return {
    ...issue,
    path: issue.path.slice(0, -1),
    message: raw.issues?.[0]?.message ?? issue.message,
    key: String(key),
  } as Issue;
};

/**
 * フォームごとの実行時の状態。
 *
 * 1. dynamic が resolve した schema の登録先（{@link RegisteredSchema}）
 * 2. 値の変更の出どころの記録（利用者の編集か、外からの変更か）
 *
 * 出どころは、TanStack Form の store の購読（値の変更と同期で呼ばれる）で、
 * 値が変わるたびに通し番号を進めて記録する。{@link runAsUserEdit} の中なら
 * 「利用者の編集」、外なら「外から」。reset と defaultValues の反映は、
 * 包みの中でも常に「外から」とする。
 */
export class FormRuntime {
  private readonly entries = new Map<string, Map<number, RegisteredSchema>>();
  private userEditDepth = 0;
  private externalDepth = 0;
  private rev = 0;
  private lastUserRev = 0;
  private lastExternalRev = 0;
  private form: AnyFormApi | undefined;
  private detach: (() => void) | undefined;
  private validateScheduled = false;
  private readonly defaultFills = new Map<string, z.ZodTypeAny>();
  private readonly defaultFillListeners = new Set<() => void>();
  private defaultFillsVersion = 0;
  private readonly fillCache = new Map<
    string,
    { schema: z.ZodTypeAny; input: unknown; output: unknown }[]
  >();

  /**
   * fn を同期で実行し、そのあいだに起きた値の変更を「利用者の編集」として記録する。
   * 入れ子は許す。fn が Promise を返したらエラーにする（await のあとの書き込みには
   * 印が付かないため。非同期に書き込むときは、書き込む瞬間に包む）。
   */
  runAsUserEdit = <T>(fn: () => T): T => {
    this.userEditDepth += 1;
    let result: T;
    try {
      result = fn();
    } finally {
      this.userEditDepth -= 1;
    }
    if (isThenable(result)) {
      throw new Error(
        "runAsUserEdit: fn must be synchronous. Wrap each write after await instead.",
      );
    }
    return result;
  };

  /** フォームに付ける。値の変更の出どころの記録を始める */
  attach(form: AnyFormApi): void {
    if (this.form === form) return;
    this.detach?.();
    this.form = form;
    let lastValues = form.state.values;
    const subscription = form.store.subscribe(() => {
      const values = form.state.values;
      if (values === lastValues) return;
      lastValues = values;
      this.rev += 1;
      if (this.userEditDepth > 0 && this.externalDepth === 0) {
        this.lastUserRev = this.rev;
      } else {
        this.lastExternalRev = this.rev;
      }
    });

    // reset と defaultValues の反映（update）は、包みの中でも外からの変更とする
    const formAny = form as any;
    const originalReset = formAny.reset;
    const originalUpdate = formAny.update;
    const asExternal =
      (original: (...args: any[]) => any) =>
      (...args: any[]) => {
        this.externalDepth += 1;
        try {
          return original.apply(form, args);
        } finally {
          this.externalDepth -= 1;
        }
      };
    formAny.reset = asExternal(originalReset);
    formAny.update = asExternal(originalUpdate);

    this.detach = () => {
      subscription.unsubscribe();
      formAny.reset = originalReset;
      formAny.update = originalUpdate;
    };
  }

  /** フォームから外す（attach の逆） */
  release(form: AnyFormApi): void {
    if (this.form !== form) return;
    this.detach?.();
    this.detach = undefined;
    this.form = undefined;
  }

  /** 現在の通し番号。dynamic が「どこまで見たか」を覚えるのに使う */
  currentRev(): number {
    return this.rev;
  }

  /**
   * seenRev のあとの変更の出どころ。利用者の編集があり、外からの変更が無ければ
   * "user"、それ以外は "external"。
   */
  causeSince(seenRev: number): EditCause {
    return this.lastUserRev > seenRev && this.lastExternalRev <= seenRev
      ? "user"
      : "external";
  }

  set(path: string, depth: number, entry: RegisteredSchema): void {
    let byDepth = this.entries.get(path);
    if (!byDepth) {
      byDepth = new Map();
      this.entries.set(path, byDepth);
    }
    byDepth.set(depth, entry);
    this.scheduleValidate();
  }

  remove(path: string, depth: number): void {
    const byDepth = this.entries.get(path);
    if (!byDepth || !byDepth.has(depth)) return;
    byDepth.delete(depth);
    if (byDepth.size === 0) this.entries.delete(path);
    this.scheduleValidate();
  }

  /** path の一番深い登録 */
  get(path: string): RegisteredSchema | undefined {
    const byDepth = this.entries.get(path);
    if (!byDepth || byDepth.size === 0) return undefined;
    return byDepth.get(Math.max(...byDepth.keys()));
  }

  /**
   * path の値を、schema の既定値で補うことを登録する（dynamic が、schema が最初に決まったときに置く）。
   * AutoForm は {@link applyDefaultFills} で、フォームに渡す defaultValues にも同じ補いを入れる。
   * そうすると、補った値も「初期値のまま」（isDefaultValue）とみなされ、reset でも残る
   */
  setDefaultFill(path: string, schema: z.ZodTypeAny): void {
    if (this.defaultFills.get(path) === schema) return;
    this.defaultFills.set(path, schema);
    this.notifyDefaultFills();
  }

  /** {@link setDefaultFill} の登録を外す。schema を渡したら、同じ schema の登録のときだけ外す */
  removeDefaultFill(path: string, schema?: z.ZodTypeAny): void {
    const current = this.defaultFills.get(path);
    if (current === undefined) return;
    if (schema !== undefined && current !== schema) return;
    this.defaultFills.delete(path);
    this.fillCache.delete(path);
    this.notifyDefaultFills();
  }

  /** 補いの登録が変わったら呼ぶ。外す関数を返す */
  subscribeDefaultFills(listener: () => void): () => void {
    this.defaultFillListeners.add(listener);
    return () => {
      this.defaultFillListeners.delete(listener);
    };
  }

  /** 補いの登録の版。登録が変わるたびに進む */
  getDefaultFillsVersion(): number {
    return this.defaultFillsVersion;
  }

  /**
   * defaults に、登録された補いを入れた値を返す。浅い path から順に入れる。
   * path の親が defaults に無いとき（配列の範囲の外を含む）は、その補いを入れない
   * （利用者が足した配列の要素などを、初期値の側に作らないため）。
   * 何も変わらなければ defaults をそのまま返す
   */
  applyDefaultFills<T>(defaults: T): T {
    if (this.defaultFills.size === 0) return defaults;
    const fills = Array.from(this.defaultFills, ([path, schema]) => ({
      path,
      segments: parseFieldPath(path),
      schema,
    })).sort((a, b) => a.segments.length - b.segments.length);
    let result: unknown = defaults;
    for (const { path, segments, schema } of fills) {
      result = fillAt(result, segments, (value) =>
        this.fillValue(path, schema, value),
      );
    }
    return isEqualValue(result, defaults) ? defaults : (result as T);
  }

  /**
   * path の値 value を、schema の既定値で補った値（`getDefaultValue(schema, value)`）を返す。
   * 同じ path・schema・値なら前に作った結果を返す。`.default(() => crypto.randomUUID())` のような
   * 作るたびに変わる既定値を、今の値と defaultValues で同じにし、登録が変わって計算し直しても変えないため
   */
  fillValue(path: string, schema: z.ZodTypeAny, value: unknown): unknown {
    const cached = this.fillCache.get(path) ?? [];
    const hit = cached.find(
      (entry) => entry.schema === schema && isEqualValue(entry.input, value),
    );
    if (hit) return hit.output;
    const output = getDefaultValue(schema, value);
    this.fillCache.set(path, [
      { schema, input: value, output },
      ...cached.slice(0, FILL_CACHE_SIZE - 1),
    ]);
    return output;
  }

  private notifyDefaultFills() {
    this.defaultFillsVersion += 1;
    for (const listener of Array.from(this.defaultFillListeners)) listener();
  }

  // 登録が変わったら、フォーム全体の検証を走らせる（同じ tick の変更はまとめる）
  private scheduleValidate() {
    if (this.validateScheduled) return;
    this.validateScheduled = true;
    queueMicrotask(() => {
      this.validateScheduled = false;
      const form = this.form;
      if (!form) return;
      void form.validate("change");
    });
  }

  /**
   * 静的な schema と、登録された schema の両方で値を検証する。
   *
   * 登録された path の下は、静的な schema（や、より浅い登録）の issue を捨て、
   * その path の一番深い登録の issue を使う。
   */
  validate(staticSchema: z.ZodTypeAny, value: unknown): Issue[] {
    const registered = Array.from(this.entries.keys()).map((path) => ({
      path,
      segments: parseFieldPath(path),
    }));

    // source より具体的な登録が issue の path を覆っていれば捨てる。
    // 静的な schema は、ルートの登録よりも浅いものとして扱う（sourceSegments が null）
    const isCovered = (
      sourceSegments: readonly PathSegment[] | null,
      issuePath: readonly PathSegment[],
    ) =>
      registered.some(
        ({ segments }) =>
          (sourceSegments === null ||
            (segments.length > sourceSegments.length &&
              pathStartsWith(segments, sourceSegments))) &&
          pathStartsWith(issuePath, segments),
      );

    const issues: Issue[] = [];
    const collect = (
      sourceSegments: readonly PathSegment[] | null,
      result: { success: boolean; error?: { issues: z.core.$ZodIssue[] } },
    ) => {
      if (result.success || !result.error) return;
      for (const issue of result.error.issues) {
        const path = [
          ...(sourceSegments ?? []),
          ...normalizeIssuePath(issue.path),
        ];
        if (isCovered(sourceSegments, path)) continue;
        // 一番外の path だけを付け直し、ほかの欄は残す。invalid_union の errors
        // （腕ごとの issue。path はその union の値からの相対）は書き換えない
        issues.push(moveInvalidKeyIssue({ ...issue, path }));
      }
    };

    collect(
      null,
      staticSchema.safeParse(value, { error: zodMsgKeyErrorMap }) as any,
    );
    for (const { path, segments } of registered) {
      const entry = this.get(path);
      if (!entry) continue;
      if (entry.status === "pending") {
        if (!isCovered(segments, segments)) {
          issues.push({
            message: msgKey(
              "zodFormReact.dynamic.loading" /* i18n: 読み込み中 */,
            ),
            path: segments,
            code: PENDING_ISSUE_CODE,
          });
        }
        continue;
      }
      if (entry.status === "error") {
        if (!isCovered(segments, segments)) {
          issues.push({
            message: msgKey(
              "zodFormReact.dynamic.failed" /* i18n: 取得できませんでした */,
            ),
            path: segments,
            code: RESOLVE_ERROR_ISSUE_CODE,
          });
        }
        continue;
      }
      collect(
        segments,
        entry.schema.safeParse(getValueAt(value, segments), {
          error: zodMsgKeyErrorMap,
        }) as any,
      );
    }
    return issues;
  }

  /**
   * 送信する値を parse して、output（`.transform()`・`.default()`・`z.coerce` などを通した値）を返す。
   *
   * dynamic の output を先に値へ差し込んでから、静的な schema で parse する。
   * 1. 登録された path を深い順に並べ、それぞれ今の値のその path を、その path の一番深い登録の schema で parse する。
   *    読み込み中・取得の失敗・parse の失敗は、送信しない（`success: false`）
   * 2. その path に output を差し込む（内側の dynamic が先なので、外側の dynamic は内側の output を受け取る。
   *    外側から見ると内側の土台は `z.unknown()` なので、output がそのまま通る）
   * 3. 差し込んだ値を静的な schema で parse し、その output を返す
   *
   * 外側の transform・refine は、dynamic を parse した後の値を受け取る（zod で親が子の output を受け取るのと同じ）
   */
  parse(
    staticSchema: z.ZodTypeAny,
    value: unknown,
  ): { success: true; data: unknown } | { success: false; issues: Issue[] } {
    const registered = Array.from(this.entries.keys())
      .map((path) => ({ path, segments: parseFieldPath(path) }))
      .sort((a, b) => b.segments.length - a.segments.length);

    let current = value;
    for (const { path, segments } of registered) {
      const entry = this.get(path);
      if (!entry) continue;
      if (entry.status !== "resolved") {
        return {
          success: false,
          issues: [
            entry.status === "pending"
              ? {
                  message: msgKey(
                    "zodFormReact.dynamic.loading" /* i18n: 読み込み中 */,
                  ),
                  path: segments,
                  code: PENDING_ISSUE_CODE,
                }
              : {
                  message: msgKey(
                    "zodFormReact.dynamic.failed" /* i18n: 取得できませんでした */,
                  ),
                  path: segments,
                  code: RESOLVE_ERROR_ISSUE_CODE,
                },
          ],
        };
      }
      const result = entry.schema.safeParse(getValueAt(current, segments), {
        error: zodMsgKeyErrorMap,
      });
      if (!result.success) {
        return {
          success: false,
          issues: result.error.issues.map((issue) => ({
            ...issue,
            path: [...segments, ...normalizeIssuePath(issue.path)],
          })) as Issue[],
        };
      }
      current = fillAt(current, segments, () => result.data);
    }

    const result = staticSchema.safeParse(current, {
      error: zodMsgKeyErrorMap,
    });
    if (!result.success) {
      return {
        success: false,
        issues: result.error.issues.map((issue) => ({
          ...issue,
          path: normalizeIssuePath(issue.path),
        })) as Issue[],
      };
    }
    return { success: true, data: result.data };
  }

  /**
   * 静的な schema を包み、登録された schema も使って検証する standard schema を返す。
   * フォームの validators（onChange / onBlur / onSubmit）にそのまま渡す。
   */
  wrapValidator<TInput>(
    staticSchema: z.ZodTypeAny,
  ): StandardSchemaV1<TInput, unknown> {
    return {
      "~standard": {
        version: 1,
        vendor: "zod-form",
        validate: (value: unknown) => {
          const issues = this.validate(staticSchema, value);
          return issues.length > 0 ? { issues } : { value };
        },
      },
    } as StandardSchemaV1<TInput, unknown>;
  }
}
