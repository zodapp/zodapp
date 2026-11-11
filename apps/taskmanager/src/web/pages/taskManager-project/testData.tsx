import { Container, Group, Title } from "@mantine/core";
import { useParams } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";
import { useApi } from "@zodapp/zod-dynamodb-react";

import type { Api } from "../../shared/api";
import { postJson } from "../../shared/api";
import {
  TestDataPanel,
  type TestDataRunContext,
  type TestDataSection,
} from "../../components/TestDataPanel";
import { useCodeViewerModal } from "../../components/useCodeViewerModal";
import { taskTestDataRoute } from "./testData.route";
import { buildSeedTasks, wait } from "./seed";

import pageCode from "./testData.tsx?raw";
import seedCode from "./seed.ts?raw";

/** 1 件ずつ投入するときの件数（zodapp と同じ 30 件・100ms 間隔） */
const SEED_TASK_COUNT = 30;
/** まとめて投入するときの既定件数 */
const BULK_TASK_COUNT = 200;
/** サーバーの /test-data/tasks が 1 回に受け付ける上限 */
const BULK_CHUNK = 500;

const TaskTestDataPage = () => {
  const { workspaceId, projectId } = useParams({ from: taskTestDataRoute.id });
  const api = useApi<Api>();
  const scope = useMemo(
    () => ({ workspaceId, projectId }),
    [workspaceId, projectId],
  );

  // 1 件ずつ API で作る。一覧を開いた別のタブに、1 件ずつ届くのが見える
  const seedOneByOne = useCallback(
    async ({ count, report, isAborted }: TestDataRunContext) => {
      const tasks = buildSeedTasks(count);
      let done = 0;
      for (const task of tasks) {
        if (isAborted()) return;
        await api.tasks.create(scope, task);
        done += 1;
        report(done);
        await wait(100);
      }
    },
    [api, scope],
  );

  // 件数が多いときは、サーバーのルートが bulkWrite でまとめて書く
  const seedBulk = useCallback(
    async ({ count, report, isAborted }: TestDataRunContext) => {
      let done = 0;
      while (done < count) {
        if (isAborted()) return;
        const size = Math.min(BULK_CHUNK, count - done);
        await postJson("/test-data/tasks", {
          ...scope,
          tasks: buildSeedTasks(size, done),
        });
        done += size;
        report(done);
      }
    },
    [scope],
  );

  const sections = useMemo<TestDataSection[]>(
    () => [
      {
        kind: "repeatable",
        title: "タスク（1 件ずつ）",
        description:
          "このプロジェクトにダミータスクを 100ms 間隔で追加します。タスク一覧を別のタブで開いておくと、リアルタイムに増えていくのを確認できます。",
        defaultCount: SEED_TASK_COUNT,
        countEditable: false,
        run: seedOneByOne,
      },
      {
        kind: "repeatable",
        title: "タスク（まとめて）",
        description:
          "サーバーの bulkWrite でダミータスクをまとめて追加します。一覧のページングを確かめるときに使います。",
        defaultCount: BULK_TASK_COUNT,
        countEditable: true,
        run: seedBulk,
      },
    ],
    [seedOneByOne, seedBulk],
  );

  const { trigger: codeViewerTrigger, modal: codeViewerModal } =
    useCodeViewerModal({ pageCode, collectionCode: seedCode });

  return (
    <Container size="md">
      <Group justify="space-between" mb="lg">
        <Title order={2}>テストデータ</Title>
        {codeViewerTrigger}
      </Group>

      <TestDataPanel sections={sections} />

      {codeViewerModal}
    </Container>
  );
};

export default TaskTestDataPage;
