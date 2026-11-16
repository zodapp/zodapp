/**
 * デモページで起きた出来事の記録（ログ）。
 *
 * 見るための部品（E2eHarness）が、開いているページのログの書き先を登録する。
 * resolver や load は form-demo の中にあるので、呼ばれたことはここへ書く。
 * 書き先が無いとき（部品の無いページ）は捨てる
 */
import type {
  ExternalKeyResolverEntry,
  ExternalKeyResolvers,
} from "@zodapp/zod-form";

/** 値の変更。変わった欄ごとに、前の値と後の値 */
export type ValueChange = { path: string; before: unknown; after: unknown };

/** dynamic の欄の状態。DOM の data-dynamic-status を、欄の名前と並べたもの */
export type DynamicStatus = { label: string; status: string };

export type FormDemoLogEvent =
  | { type: "value"; changes: ValueChange[] }
  | {
      type: "fetch";
      /** externalKey の購読（subscribe）か、dynamic の取得（load） */
      kind: "subscribe" | "load";
      /** どの欄か。externalKey の resolver は欄を知らないので、topic を書く */
      field: string;
      key: string;
      /** 呼ばれた・届いた・失敗した */
      result: "called" | "delivered" | "failed";
    }
  | { type: "dynamic-status"; statuses: DynamicStatus[] }
  | { type: "submit"; result: "attempted" | "passed" | "blocked" };

/** 時刻（ページを開いてからの ms）付きのログの 1 件 */
export type FormDemoLogEntry = FormDemoLogEvent & { at: number };

type Sink = (event: FormDemoLogEvent) => void;

let currentSink: Sink | undefined;

/** ログの書き先を登録する。戻り値で外す */
export const setFormDemoLogSink = (sink: Sink): (() => void) => {
  currentSink = sink;
  return () => {
    if (currentSink === sink) currentSink = undefined;
  };
};

/** 出来事を書く。書き先が無ければ捨てる */
export const recordFormDemoEvent = (event: FormDemoLogEvent) => {
  currentSink?.(event);
};

/**
 * load を包み、呼ばれたこと・届いたこと・失敗したことをログに書く。
 * dynamic の resolve で `load: logLoad("templateFields", key, async () => …)` のように使う
 */
export const logLoad =
  <T>(field: string, key: string, load: () => Promise<T>) =>
  async (): Promise<T> => {
    recordFormDemoEvent({
      type: "fetch",
      kind: "load",
      field,
      key,
      result: "called",
    });
    try {
      const result = await load();
      recordFormDemoEvent({
        type: "fetch",
        kind: "load",
        field,
        key,
        result: "delivered",
      });
      return result;
    } catch (error) {
      recordFormDemoEvent({
        type: "fetch",
        kind: "load",
        field,
        key,
        result: "failed",
      });
      throw error;
    }
  };

/**
 * externalKey の resolver を包み、購読・届いた選択肢・失敗をログに書く。
 * resolver は欄を知らないので、field と key には config の topic を書く
 */
export const withFetchLog = (
  resolvers: ExternalKeyResolvers,
): ExternalKeyResolvers =>
  resolvers.map(
    (entry): ExternalKeyResolverEntry<string, { topic?: string }> => ({
      type: entry.type,
      resolver: (config, resolverContext) => {
        const inner = entry.resolver(config, resolverContext);
        const topic = String(config.topic ?? config.type);
        const record = (result: "called" | "delivered" | "failed") =>
          recordFormDemoEvent({
            type: "fetch",
            kind: "subscribe",
            field: topic,
            key: topic,
            result,
          });
        return {
          subscribe: (callback, onError) => {
            record("called");
            return inner.subscribe(
              (options) => {
                record("delivered");
                callback(options);
              },
              (error) => {
                record("failed");
                onError?.(error);
              },
            );
          },
        };
      },
    }),
  );
