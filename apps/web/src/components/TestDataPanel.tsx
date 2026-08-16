import { useCallback, useRef, useState, type ReactNode } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Code,
  Group,
  NumberInput,
  Progress,
  Stack,
  Text,
  Timeline,
} from "@mantine/core";
import {
  IconAlertTriangle,
  IconCheck,
  IconInfoCircle,
  IconPlayerStop,
  IconRefresh,
  IconTrash,
} from "@tabler/icons-react";
import { useDeleteModal } from "@zodapp/zod-form-widget/feedback";

/**
 * テストデータ投入 UI（アンケート / タスク管理で共通）。
 *
 * 2 種類のセクションを持つ:
 * - `idempotent`: 固定 ID で上書きする構造データ。再投入しても増えない
 * - `repeatable`: 実行するたびに増えるボリュームデータ。
 *   GrowingList などのリアクティブ動作を確認するためのもの
 *
 * このページは別タブで開く運用を想定している（一覧を開いたまま投入すると、
 * 一覧側がリアルタイムに増えていく様子を観察できる）。
 */

export type TestDataRunContext = {
  count: number;
  /** 進捗の報告（完了件数） */
  report: (done: number) => void;
  /** 中止が要求されたか */
  isAborted: () => boolean;
};

export type IdempotentSection = {
  kind: "idempotent";
  title: string;
  description: string;
  /** 書き込むドキュメントのパス（表示用） */
  targets: string[];
  run: () => Promise<void>;
  clear: () => Promise<void>;
  clearConfirmMessage?: string;
};

export type RepeatableSection = {
  kind: "repeatable";
  title: string;
  description: string;
  defaultCount: number;
  /** 件数をユーザーが変更できるか（false なら defaultCount 固定） */
  countEditable?: boolean;
  /** 件数入力の上に差し込む追加コントロール（対象の選択など） */
  extraControls?: ReactNode;
  disabled?: boolean;
  disabledReason?: string;
  run: (context: TestDataRunContext) => Promise<void>;
};

export type TestDataSection = IdempotentSection | RepeatableSection;

type LogEntry = {
  id: number;
  message: string;
  status: "success" | "error";
};

const IdempotentCard = ({
  section,
  onLog,
}: {
  section: IdempotentSection;
  onLog: (message: string, status: LogEntry["status"]) => void;
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [isDone, setIsDone] = useState(false);

  const handleRun = useCallback(async () => {
    setIsRunning(true);
    try {
      await section.run();
      setIsDone(true);
      onLog(`${section.title}: ${section.targets.length} 件を投入しました`, "success");
    } catch (error) {
      onLog(
        `${section.title}: 投入に失敗しました（${String(error)}）`,
        "error",
      );
    } finally {
      setIsRunning(false);
    }
  }, [section, onLog]);

  const { open: openClear, modal: clearModal } = useDeleteModal({
    title: `${section.title}を削除`,
    message:
      section.clearConfirmMessage ??
      "テストデータとして投入したドキュメントのみを削除します。手動で作成したデータは削除されません。",
    confirmLabel: "削除する",
    onDelete: async () => {
      setIsRunning(true);
      try {
        await section.clear();
        setIsDone(false);
        onLog(`${section.title}: 削除しました`, "success");
      } catch (error) {
        onLog(
          `${section.title}: 削除に失敗しました（${String(error)}）`,
          "error",
        );
      } finally {
        setIsRunning(false);
      }
    },
  });

  return (
    <Card withBorder>
      <Group justify="space-between" mb="xs">
        <Group gap="xs">
          <Text fw={500}>{section.title}</Text>
          <Badge variant="light" color="blue">
            冪等
          </Badge>
          {isDone && (
            <Badge variant="light" color="green" leftSection={<IconCheck size={12} />}>
              投入済み
            </Badge>
          )}
        </Group>
      </Group>

      <Text size="sm" c="dimmed" mb="sm">
        {section.description}
      </Text>

      <Code block mb="sm">
        {section.targets.join("\n")}
      </Code>

      <Group>
        <Button
          leftSection={<IconRefresh size={16} />}
          onClick={() => void handleRun()}
          loading={isRunning}
        >
          {isDone ? "再投入（上書き）" : "投入"}
        </Button>
        <Button
          variant="light"
          color="red"
          leftSection={<IconTrash size={16} />}
          onClick={openClear}
          disabled={isRunning}
        >
          削除
        </Button>
      </Group>

      {clearModal}
    </Card>
  );
};

const RepeatableCard = ({
  section,
  onLog,
}: {
  section: RepeatableSection;
  onLog: (message: string, status: LogEntry["status"]) => void;
}) => {
  const [count, setCount] = useState(section.defaultCount);
  const [isRunning, setIsRunning] = useState(false);
  const [done, setDone] = useState(0);
  const abortRef = useRef(false);

  const handleRun = useCallback(async () => {
    abortRef.current = false;
    setIsRunning(true);
    setDone(0);
    try {
      await section.run({
        count,
        report: (value) => setDone(value),
        isAborted: () => abortRef.current,
      });
      onLog(
        abortRef.current
          ? `${section.title}: 中止しました`
          : `${section.title}: ${count} 件を追加しました`,
        "success",
      );
    } catch (error) {
      onLog(
        `${section.title}: 追加に失敗しました（${String(error)}）`,
        "error",
      );
    } finally {
      setIsRunning(false);
    }
  }, [section, count, onLog]);

  return (
    <Card withBorder>
      <Group justify="space-between" mb="xs">
        <Group gap="xs">
          <Text fw={500}>{section.title}</Text>
          <Badge variant="light" color="grape">
            繰り返し可
          </Badge>
        </Group>
      </Group>

      <Text size="sm" c="dimmed" mb="sm">
        {section.description}
      </Text>

      <Stack gap="sm">
        {section.extraControls}

        {section.countEditable !== false && (
          <NumberInput
            label="追加する件数"
            value={count}
            onChange={(value) =>
              setCount(typeof value === "number" ? value : section.defaultCount)
            }
            min={1}
            max={200}
            w={200}
            disabled={isRunning}
          />
        )}

        {isRunning && (
          <div>
            <Progress value={(done / count) * 100} mb={4} />
            <Text size="sm" c="dimmed">
              {done} / {count} 件
            </Text>
          </div>
        )}

        {section.disabled && section.disabledReason && (
          <Text size="sm" c="orange">
            {section.disabledReason}
          </Text>
        )}

        <Group>
          <Button
            onClick={() => void handleRun()}
            loading={isRunning}
            disabled={section.disabled}
          >
            {count} 件追加
          </Button>
          {isRunning && (
            <Button
              variant="light"
              color="orange"
              leftSection={<IconPlayerStop size={16} />}
              onClick={() => {
                abortRef.current = true;
              }}
            >
              中止
            </Button>
          )}
        </Group>
      </Stack>
    </Card>
  );
};

export const TestDataPanel = ({
  sections,
  note,
}: {
  sections: TestDataSection[];
  note?: ReactNode;
}) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logIdRef = useRef(0);

  const handleLog = useCallback(
    (message: string, status: LogEntry["status"]) => {
      logIdRef.current += 1;
      setLogs((prev) => [{ id: logIdRef.current, message, status }, ...prev].slice(0, 20));
    },
    [],
  );

  return (
    <Stack gap="lg">
      <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light">
        デモ用のテストデータを、いま開いているワークスペースに作成します。
        {note}
      </Alert>

      {sections.map((section) =>
        section.kind === "idempotent" ? (
          <IdempotentCard
            key={section.title}
            section={section}
            onLog={handleLog}
          />
        ) : (
          <RepeatableCard
            key={section.title}
            section={section}
            onLog={handleLog}
          />
        ),
      )}

      {logs.length > 0 && (
        <Card withBorder>
          <Text fw={500} mb="sm">
            実行ログ
          </Text>
          <Timeline bulletSize={18} lineWidth={2}>
            {logs.map((log) => (
              <Timeline.Item
                key={log.id}
                bullet={
                  log.status === "success" ? (
                    <IconCheck size={12} />
                  ) : (
                    <IconAlertTriangle size={12} />
                  )
                }
                color={log.status === "success" ? "green" : "red"}
              >
                <Text size="sm">{log.message}</Text>
              </Timeline.Item>
            ))}
          </Timeline>
        </Card>
      )}
    </Stack>
  );
};
