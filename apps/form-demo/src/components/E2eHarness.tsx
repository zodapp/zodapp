/**
 * 見るための部品。AutoForm の actionComponents として描き、form の API を受け取る。
 *
 * - 今の値・欄ごとのエラー・isDirty・送信した値と回数・ログを出す
 * - 同じ中身を window.__formDemo に置く。画面の表示もこの中身から描く
 * - 「送信」のボタンを持つ。送信の試みと、通ったか止まったかをログに書く
 * - 必要なページだけ、外から書き込むボタンと、利用者の編集として書き込むボタンを出す
 */
import { useLayoutEffect, useRef, useState } from "react";
import type { MsgFn } from "@zodapp/i18n-messages";
import { useMsg } from "@zodapp/i18n-messages-react";
import type { AnyFormApi } from "@tanstack/react-form";
import { Box, Button, Code, Group, Stack, Text } from "@mantine/core";
import { useRunAsUserEdit } from "@zodapp/zod-form-react/common";
import type {
  AutoFormActionComponent,
  AutoFormActionComponentProps,
} from "@zodapp/zod-form-widget/form";
import type { z } from "zod";

import {
  setFormDemoLogSink,
  type DynamicStatus,
  type FormDemoLogEntry,
  type FormDemoLogEvent,
  type ValueChange,
} from "../shared/demo/formDemoLog";

/** window.__formDemo に置く中身 */
export type FormDemoState = {
  formId: string;
  values: unknown;
  /** 欄ごとのエラー（エラーのある欄だけ）と、フォーム全体のエラー */
  errors: { fields: Record<string, string[]>; form: string[] };
  isDirty: boolean;
  /** 今の値が defaultValues と同じか（保存ボタンの判定などに使う） */
  isDefaultValue: boolean;
  submitted: { count: number; values: unknown };
  log: FormDemoLogEntry[];
};

declare global {
  interface Window {
    __formDemo?: FormDemoState;
  }
}

/** 書き込みのボタン。asUser なら利用者の編集として書く（useRunAsUserEdit） */
export type HarnessWrite = {
  label: string;
  asUser?: boolean;
  run: (form: AnyFormApi) => void;
};

export type E2eHarnessOptions = {
  formId: string;
  /** 「送信」のボタンを出すか。既定は出す */
  submit?: boolean;
  writes?: readonly HarnessWrite[];
};

const toJson = (value: unknown) =>
  JSON.stringify(
    value,
    (_key, v) =>
      typeof v === "bigint"
        ? v.toString()
        : v instanceof Set
          ? [...v]
          : v instanceof Map
            ? Object.fromEntries(v)
            : v,
    2,
  ) ?? "undefined";

const isPlainContainer = (value: unknown): value is object =>
  typeof value === "object" &&
  value !== null &&
  (Array.isArray(value) || Object.getPrototypeOf(value) === Object.prototype);

/** 前の値と後の値で、変わった欄（葉）を集める */
const diffValues = (
  before: unknown,
  after: unknown,
  path = "",
  out: ValueChange[] = [],
): ValueChange[] => {
  if (Object.is(before, after)) return out;
  if (isPlainContainer(before) && isPlainContainer(after)) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const key of keys) {
      diffValues(
        (before as Record<string, unknown>)[key],
        (after as Record<string, unknown>)[key],
        path ? `${path}.${key}` : key,
        out,
      );
    }
    return out;
  }
  if (
    before instanceof Date &&
    after instanceof Date &&
    before.getTime() === after.getTime()
  ) {
    return out;
  }
  out.push({ path, before, after });
  return out;
};

/**
 * TanStack Form のエラー（文字列・issue・その配列・path ごとの issue の表）を、文言の配列にする。
 * 同じ文言は 1 つにまとめる（onChange と onSubmit で同じエラーが並ぶため）
 */
const messagesOf = (errors: readonly unknown[]): string[] => {
  const collect = (error: unknown): string[] => {
    if (error === undefined || error === null) return [];
    if (typeof error === "string") return [error];
    if (Array.isArray(error)) return error.flatMap(collect);
    if (typeof error === "object") {
      if ("message" in error) {
        return [String((error as { message: unknown }).message)];
      }
      return Object.values(error).flatMap(collect);
    }
    return [String(error)];
  };
  return [...new Set(errors.flatMap(collect))];
};

const errorsOf = (form: AnyFormApi): FormDemoState["errors"] => {
  const all = form.getAllErrors();
  const fields: Record<string, string[]> = {};
  for (const [path, field] of Object.entries(
    all.fields as Record<string, { errors: unknown[] }>,
  )) {
    const messages = messagesOf(field.errors);
    if (messages.length > 0) fields[path] = messages;
  }
  return { fields, form: messagesOf(all.form.errors) };
};

/** data-dynamic-status を持つ要素の、欄の名前 */
const labelOfStatusElement = (element: Element): string => {
  if (element instanceof HTMLInputElement) {
    const label = element.labels?.[0]?.textContent;
    if (label) return label.replace(/\s*\*\s*$/, "").trim();
  }
  const text = element.textContent ?? "";
  // 取得の失敗の表示（zod-form-mantine-lite の fetchFailedWithLabel。ja・en）から、欄の名前を取り出す
  const failed =
    text.match(/^(.*)を取得できませんでした/) ??
    text.match(/^Failed to load (.*)$/);
  if (failed?.[1]) return failed[1];
  return "";
};

const readStatuses = (root: Element): DynamicStatus[] =>
  [...root.querySelectorAll("[data-dynamic-status]")].map((element) => ({
    label: labelOfStatusElement(element),
    status: element.getAttribute("data-dynamic-status") ?? "",
  }));

const describeEntry = (entry: FormDemoLogEntry, msg: MsgFn): string => {
  const at = `${entry.at}ms`;
  switch (entry.type) {
    case "value":
      return `${at} ${msg(
        "formDemo.app.harness.logValue" /* i18n: 値: ${changes} */,
        {
          changes: entry.changes
            .map(
              (change) =>
                `${change.path} ${toJson(change.before).replace(/\s+/g, " ")} → ${toJson(change.after).replace(/\s+/g, " ")}`,
            )
            .join(", "),
        },
      )}`;
    case "fetch":
      return `${at} ${msg(
        "formDemo.app.harness.logFetch" /* i18n: 取得（${kind}）: ${field} key=${key} ${result} */,
        {
          kind: entry.kind,
          field: entry.field,
          key: String(entry.key),
          result: {
            called: msg(
              "formDemo.app.harness.fetch.called" /* i18n: 呼ばれた */,
            ),
            delivered: msg(
              "formDemo.app.harness.fetch.delivered" /* i18n: 届いた */,
            ),
            failed: msg(
              "formDemo.app.harness.fetch.failed" /* i18n: 失敗した */,
            ),
          }[entry.result],
        },
      )}`;
    case "dynamic-status":
      return `${at} ${msg(
        "formDemo.app.harness.logDynamic" /* i18n: dynamic の状態: ${statuses} */,
        {
          statuses:
            entry.statuses.length === 0
              ? msg(
                  "formDemo.app.harness.noDynamic" /* i18n: 読み込み中・失敗の欄なし */,
                )
              : entry.statuses
                  .map(
                    (status) =>
                      `${status.label || msg("formDemo.app.harness.unnamed" /* i18n: （名前なし） */)}=${status.status}`,
                  )
                  .join(", "),
        },
      )}`;
    case "submit":
      return `${at} ${msg(
        "formDemo.app.harness.logSubmit" /* i18n: 送信: ${result} */,
        {
          result: {
            attempted: msg(
              "formDemo.app.harness.submit.attempted" /* i18n: 試みた */,
            ),
            passed: msg(
              "formDemo.app.harness.submit.passed" /* i18n: 通った */,
            ),
            blocked: msg(
              "formDemo.app.harness.submit.blocked" /* i18n: 止まった */,
            ),
          }[entry.result],
        },
      )}`;
  }
};

const E2eHarnessView = ({
  form,
  handleSubmit,
  options,
}: AutoFormActionComponentProps<z.ZodTypeAny> & {
  options: E2eHarnessOptions;
}) => {
  const { formId, submit = true, writes = [] } = options;
  const msg = useMsg();
  const runAsUserEdit = useRunAsUserEdit();
  const boxRef = useRef<HTMLDivElement>(null);

  const buildState = (
    previous: FormDemoState | undefined,
    patch: Partial<FormDemoState> = {},
  ): FormDemoState => ({
    formId,
    values: form.state.values,
    errors: errorsOf(form),
    isDirty: form.state.isDirty,
    isDefaultValue: form.state.isDefaultValue,
    submitted: previous?.submitted ?? { count: 0, values: undefined },
    log: previous?.log ?? [],
    ...patch,
  });

  const stateRef = useRef<FormDemoState | undefined>(undefined);
  const [state, setState] = useState<FormDemoState>(() =>
    buildState(undefined),
  );

  useLayoutEffect(() => {
    const commit = (next: FormDemoState) => {
      stateRef.current = next;
      window.__formDemo = next;
      setState(next);
    };
    const record = (event: FormDemoLogEvent) => {
      const current = stateRef.current ?? buildState(undefined);
      const entry = {
        ...event,
        at: Math.round(performance.now()),
      } as FormDemoLogEntry;
      commit(buildState(current, { log: [...current.log, entry] }));
    };
    commit(buildState(undefined));

    const offSink = setFormDemoLogSink(record);

    // 値の変更
    let previousValues = form.state.values;
    const subscription = form.store.subscribe(() => {
      const values = form.state.values;
      const changes = diffValues(previousValues, values);
      previousValues = values;
      if (changes.length > 0) {
        record({ type: "value", changes });
      } else {
        commit(buildState(stateRef.current));
      }
    });

    // dynamic の状態（DOM の data-dynamic-status）
    const root = boxRef.current?.closest("form");
    let lastStatuses = "[]";
    const observeStatuses = () => {
      if (!root) return;
      const statuses = readStatuses(root);
      const json = JSON.stringify(statuses);
      if (json === lastStatuses) return;
      lastStatuses = json;
      record({ type: "dynamic-status", statuses });
    };
    observeStatuses();
    const observer = new MutationObserver(observeStatuses);
    if (root) {
      observer.observe(root, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ["data-dynamic-status"],
      });
    }

    return () => {
      observer.disconnect();
      subscription.unsubscribe();
      offSink();
      if (window.__formDemo === stateRef.current) delete window.__formDemo;
    };
    // form は AutoForm の中で変わらない
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  const recordSubmit = (result: "attempted" | "passed" | "blocked") => {
    const current = stateRef.current ?? buildState(undefined);
    return buildState(current, {
      log: [
        ...current.log,
        { type: "submit", result, at: Math.round(performance.now()) },
      ],
    });
  };

  const onSubmit = async () => {
    const attempted = recordSubmit("attempted");
    stateRef.current = attempted;
    window.__formDemo = attempted;
    setState(attempted);
    const result = await handleSubmit();
    const finished = recordSubmit(result === undefined ? "blocked" : "passed");
    const next =
      result === undefined
        ? finished
        : {
            ...finished,
            submitted: {
              count: finished.submitted.count + 1,
              values: result,
            },
          };
    stateRef.current = next;
    window.__formDemo = next;
    setState(next);
  };

  const errorEntries = Object.entries(state.errors.fields);

  return (
    <>
      {writes.map((write) => (
        <Button
          key={write.label}
          variant="default"
          onClick={() =>
            write.asUser
              ? runAsUserEdit(() => write.run(form))
              : write.run(form)
          }
        >
          {msg.resolve(write.label)}
        </Button>
      ))}
      {submit && (
        <Button type="submit" onClick={() => void onSubmit()}>
          {msg("formDemo.app.harness.submit" /* i18n: 送信 */)}
        </Button>
      )}
      <Box
        ref={boxRef}
        data-testid="form-demo-harness"
        style={{ flexBasis: "100%", order: 1 }}
      >
        <Stack gap={4}>
          <Code block style={{ maxHeight: 200, overflow: "auto" }}>
            {toJson(state.values)}
          </Code>
          <Text size="xs" c="dimmed">
            isDirty: {String(state.isDirty)} / isDefaultValue:{" "}
            {String(state.isDefaultValue)}
            {submit &&
              ` / ${msg(
                "formDemo.app.harness.submitted" /* i18n: 送信: ${count} 回 */,
                {
                  count: String(state.submitted.count),
                },
              )}${
                state.submitted.count > 0
                  ? msg(
                      "formDemo.app.harness.submittedValues" /* i18n: （送信した値: ${values}） */,
                      {
                        values: toJson(state.submitted.values).replace(
                          /\s+/g,
                          " ",
                        ),
                      },
                    )
                  : ""
              }`}
          </Text>
          <Text size="xs" c="dimmed">
            {msg("formDemo.app.harness.errors" /* i18n: エラー: */)}{" "}
            {errorEntries.length === 0 && state.errors.form.length === 0
              ? msg("formDemo.app.harness.noErrors" /* i18n: なし */)
              : [
                  ...errorEntries.map(
                    ([path, messages]) =>
                      `${path}: ${messages.map((message) => msg.resolve(message)).join(" / ")}`,
                  ),
                  ...state.errors.form.map((message) =>
                    msg(
                      "formDemo.app.harness.formError" /* i18n: （全体）${message} */,
                      {
                        message: msg.resolve(message),
                      },
                    ),
                  ),
                ].join(
                  msg("formDemo.app.harness.errorSeparator" /* i18n: 、 */),
                )}
          </Text>
          <details>
            <summary>
              <Text span size="xs" c="dimmed">
                {msg(
                  "formDemo.app.harness.log" /* i18n: ログ（${count} 件） */,
                  {
                    count: String(state.log.length),
                  },
                )}
              </Text>
            </summary>
            <Group gap={0}>
              <Code
                block
                style={{ maxHeight: 240, overflow: "auto", width: "100%" }}
              >
                {state.log.map((entry) => describeEntry(entry, msg)).join("\n")}
              </Code>
            </Group>
          </details>
        </Stack>
      </Box>
    </>
  );
};

/**
 * 見るための部品を、AutoForm の actionComponents に渡す形で作る。
 * 描くたびに作り直さないよう、モジュールの中か useMemo で作る
 */
export const createE2eHarness = <T extends z.ZodTypeAny>(
  options: E2eHarnessOptions,
): AutoFormActionComponent<T> => {
  const Harness = (props: AutoFormActionComponentProps<T>) => (
    <E2eHarnessView
      {...(props as AutoFormActionComponentProps<z.ZodTypeAny>)}
      options={options}
    />
  );
  Harness.displayName = "E2eHarness";
  return Harness;
};
