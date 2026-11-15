/* eslint-disable @typescript-eslint/no-explicit-any */
import type { AnyFormApi, StandardSchemaV1 } from "@tanstack/react-form";
import type { z } from "zod";
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
        issues.push({ message: issue.message, path, code: issue.code });
      }
    };

    collect(null, staticSchema.safeParse(value) as any);
    for (const { path, segments } of registered) {
      const entry = this.get(path);
      if (!entry) continue;
      if (entry.status === "pending") {
        if (!isCovered(segments, segments)) {
          issues.push({
            message: "読み込み中",
            path: segments,
            code: PENDING_ISSUE_CODE,
          });
        }
        continue;
      }
      if (entry.status === "error") {
        if (!isCovered(segments, segments)) {
          issues.push({
            message: "取得できませんでした",
            path: segments,
            code: RESOLVE_ERROR_ISSUE_CODE,
          });
        }
        continue;
      }
      collect(segments, entry.schema.safeParse(getValueAt(value, segments)) as any);
    }
    return issues;
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
