import { msgKey } from "@zodapp/i18n-messages";
import { useMsg } from "@zodapp/i18n-messages-react";
/**
 * デモページで、取得の時機（遅延の分け方）と失敗を決める仕組み。
 *
 * 分け方は「何と競るか」で決める（ms はテストの根拠にしない）。
 * - 見やすい遅延：人が読み込み中を見られるように ms 待つ（人が開いたときの既定）
 * - すぐ届く：externalKey は値のある topic を購読する（その場で届く）。load は解決済みの Promise を返す
 * - 1 フレーム後・2 フレーム後：requestAnimationFrame を重ねてから set する（load も同じ）
 * - 止めておく：値の無い topic を購読し、「届ける」のボタンで set する（load も同じ）
 *
 * 失敗させるスイッチがオンなら、届ける代わりに失敗させる（topic の fail・load の reject）
 */
import { useSyncExternalStore } from "react";
import {
  Button,
  Group,
  SegmentedControl,
  Stack,
  Switch,
  Text,
} from "@mantine/core";
import {
  createMockExternalKeyResolver,
  createMockTopic,
  type ExternalKeyResolvers,
  type MockExternalKeyOption,
  type MockTopic,
} from "@zodapp/zod-form";

import { logLoad, withFetchLog } from "./formDemoLog";

export type DelayMode = "human" | "immediate" | "frame1" | "frame2" | "held";

/** 分け方の名前（辞書のキー。出すときに msg.resolve で訳す） */
export const delayModeLabels: Record<DelayMode, string> = {
  human: msgKey("formDemo.shared.fetch.mode.human" /* i18n: 見やすい遅延 */),
  immediate: msgKey(
    "formDemo.shared.fetch.mode.immediate" /* i18n: すぐ届く */,
  ),
  frame1: msgKey("formDemo.shared.fetch.mode.frame1" /* i18n: 1 フレーム後 */),
  frame2: msgKey("formDemo.shared.fetch.mode.frame2" /* i18n: 2 フレーム後 */),
  held: msgKey("formDemo.shared.fetch.mode.held" /* i18n: 止めておく */),
};

/** 止めておく分け方で、待っている取得 */
export type PendingFetch = {
  id: number;
  /** 画面に出す名前（どの欄・どの key か） */
  name: string;
  deliver: () => void;
  fail: () => void;
};

type ControlState = {
  mode: DelayMode;
  failing: boolean;
  pending: PendingFetch[];
};

/** 人が開いたときの待ち時間（externalKey・load）。テストはこの数字に頼らない */
const HUMAN_DELAY_MS = { externalKey: 400, load: 1000 };

export type FetchControl = {
  getState: () => ControlState;
  subscribe: (listener: () => void) => () => void;
  setMode: (mode: DelayMode) => void;
  setFailing: (failing: boolean) => void;
  /** 今の分け方で、届ける（または失敗させる）時機を決めて呼ぶ */
  schedule: (
    name: string,
    deliver: () => void,
    fail: () => void,
    humanMs: number,
  ) => () => void;
  /** 止めておいた取得を、すべて片付ける（ページを離れるとき） */
  reset: () => void;
};

export const createFetchControl = (): FetchControl => {
  let state: ControlState = { mode: "human", failing: false, pending: [] };
  const listeners = new Set<() => void>();
  let nextId = 1;
  const update = (patch: Partial<ControlState>) => {
    state = { ...state, ...patch };
    for (const listener of [...listeners]) listener();
  };
  const removePending = (id: number) =>
    update({ pending: state.pending.filter((item) => item.id !== id) });

  return {
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setMode: (mode) => update({ mode }),
    setFailing: (failing) => update({ failing }),
    schedule: (name, deliver, fail, humanMs) => {
      // 失敗させるかは、届けるときのスイッチで決める
      const settle = () => (state.failing ? fail() : deliver());
      let cancelled = false;
      switch (state.mode) {
        case "immediate":
          settle();
          return () => {};
        case "frame1":
        case "frame2": {
          const frames = state.mode === "frame1" ? 1 : 2;
          let handle = 0;
          const step = (left: number) => {
            handle = requestAnimationFrame(() => {
              if (cancelled) return;
              if (left > 1) step(left - 1);
              else settle();
            });
          };
          step(frames);
          return () => {
            cancelled = true;
            cancelAnimationFrame(handle);
          };
        }
        case "held": {
          const id = nextId++;
          update({
            pending: [
              ...state.pending,
              {
                id,
                name,
                deliver: () => {
                  removePending(id);
                  deliver();
                },
                fail: () => {
                  removePending(id);
                  fail();
                },
              },
            ],
          });
          return () => removePending(id);
        }
        case "human": {
          const timer = setTimeout(settle, humanMs);
          return () => clearTimeout(timer);
        }
      }
    },
    reset: () => update({ mode: "human", failing: false, pending: [] }),
  };
};

export const useFetchControl = (control: FetchControl) =>
  useSyncExternalStore(control.subscribe, control.getState);

/**
 * 今の分け方で、externalKey の選択肢を届ける resolver を作る。
 * 購読のたびに topic を作り、すぐ届く分け方では値のある topic を、ほかは値の無い topic を渡して、
 * 決めた時機に set（失敗させるなら fail）する。届ける選択肢は、届けるときの optionsOf で決める。
 * optionsOf が undefined を返す topic は作らない（モックの無い topic になる）。
 *
 * republish は、購読中の欄に、同じ購読のまま選択肢を届け直す（時機は今の分け方で決める）
 */
export const createControlledExternalKeyResolvers = (
  control: FetchControl,
  optionsOf: (topic: string) => MockExternalKeyOption[] | undefined,
): {
  resolvers: ExternalKeyResolvers;
  republish: (name: string) => void;
} => {
  const topics: Record<string, MockTopic<MockExternalKeyOption[]>> = {};
  const active = new Map<string, Set<MockTopic<MockExternalKeyOption[]>>>();
  const mock = createMockExternalKeyResolver({ topics });
  const failError = () =>
    new Error(
      msgKey(
        "formDemo.shared.fetch.failedError" /* i18n: 取得に失敗しました（デモ） */,
      ),
    );

  const settleLater = (
    name: string,
    topic: MockTopic<MockExternalKeyOption[]>,
  ) =>
    control.schedule(
      `externalKey: ${name}`,
      () => topic.set(optionsOf(name) ?? []),
      () => topic.fail(failError()),
      HUMAN_DELAY_MS.externalKey,
    );

  const resolvers = withFetchLog([
    {
      type: mock.type,
      resolver: (config, resolverContext) => ({
        subscribe: (callback, onError) => {
          const name = config.topic;
          const options = optionsOf(name);
          if (options === undefined) {
            delete topics[name];
            return mock
              .resolver(config, resolverContext)
              .subscribe(callback, onError);
          }
          const immediate =
            control.getState().mode === "immediate" &&
            !control.getState().failing;
          const topic = immediate
            ? createMockTopic(options)
            : createMockTopic<MockExternalKeyOption[]>();
          topics[name] = topic;
          const set = active.get(name) ?? new Set();
          set.add(topic);
          active.set(name, set);
          const unsubscribe = mock
            .resolver(config, resolverContext)
            .subscribe(callback, onError);
          const cancel = immediate ? () => {} : settleLater(name, topic);
          return () => {
            cancel();
            set.delete(topic);
            unsubscribe();
          };
        },
      }),
    },
  ]);

  return {
    resolvers,
    republish: (name) => {
      for (const topic of active.get(name) ?? []) {
        if (
          control.getState().mode === "immediate" &&
          !control.getState().failing
        ) {
          topic.set(optionsOf(name) ?? []);
        } else {
          settleLater(name, topic);
        }
      }
    },
  };
};

/**
 * 今の分け方で返す load を作る。dynamic の resolve で `load: controlledLoad(…)` のように使う。
 * 呼ばれたことと結果は、見るための部品のログに書く
 */
export const controlledLoad = <T,>(
  control: FetchControl,
  field: string,
  key: string,
  produce: () => T,
) =>
  logLoad(field, key, () => {
    if (control.getState().mode === "immediate") {
      return control.getState().failing
        ? Promise.reject(
            new Error(
              msgKey(
                "formDemo.shared.fetch.failedError" /* i18n: 取得に失敗しました（デモ） */,
              ),
            ),
          )
        : Promise.resolve(produce());
    }
    return new Promise<T>((resolve, reject) => {
      control.schedule(
        `load: ${field} key=${key}`,
        () => resolve(produce()),
        () =>
          reject(
            new Error(
              msgKey(
                "formDemo.shared.fetch.failedError" /* i18n: 取得に失敗しました（デモ） */,
              ),
            ),
          ),
        HUMAN_DELAY_MS.load,
      );
    });
  });

/** 分け方の選択・失敗させるスイッチ・止めておいた取得の一覧 */
export const FetchControlPanel = ({ control }: { control: FetchControl }) => {
  const state = useFetchControl(control);
  const msg = useMsg();
  return (
    <Stack gap="xs" data-testid="fetch-control">
      <Group gap="sm">
        <Text size="sm">
          {msg("formDemo.shared.fetch.delayMode" /* i18n: 遅延の分け方 */)}
        </Text>
        <SegmentedControl
          size="xs"
          value={state.mode}
          onChange={(value) => control.setMode(value as DelayMode)}
          data={(Object.keys(delayModeLabels) as DelayMode[]).map((mode) => ({
            value: mode,
            label: msg.resolve(delayModeLabels[mode]),
          }))}
        />
        <Text size="sm" data-testid="delay-mode">
          {msg(
            "formDemo.shared.fetch.selectedMode" /* i18n: 選んだ分け方：${mode} */,
            {
              mode: msg.resolve(delayModeLabels[state.mode]),
            },
          )}
        </Text>
      </Group>
      <Switch
        label={msg(
          "formDemo.shared.fetch.failing" /* i18n: 取得を失敗させる（オンのあいだに届く取得は失敗する） */,
        )}
        checked={state.failing}
        onChange={(event) => control.setFailing(event.currentTarget.checked)}
      />
      {state.mode === "held" && (
        <Stack gap={4}>
          <Text size="sm">
            {msg(
              "formDemo.shared.fetch.pending" /* i18n: 待っている取得（${count} 件） */,
              {
                count: String(state.pending.length),
              },
            )}
            {state.pending.length === 0 &&
              msg("formDemo.shared.fetch.pendingNone" /* i18n: ：なし */)}
          </Text>
          {state.pending.map((item) => (
            <Group key={item.id} gap="xs" data-testid="pending-fetch">
              <Text size="sm" ff="monospace">
                {item.name}
              </Text>
              <Button size="compact-xs" variant="light" onClick={item.deliver}>
                {msg("formDemo.shared.fetch.deliver" /* i18n: 届ける */)}
              </Button>
              <Button
                size="compact-xs"
                variant="light"
                color="red"
                onClick={item.fail}
              >
                {msg("formDemo.shared.fetch.fail" /* i18n: 失敗させる */)}
              </Button>
            </Group>
          ))}
        </Stack>
      )}
    </Stack>
  );
};
