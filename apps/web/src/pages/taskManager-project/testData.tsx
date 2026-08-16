import { Container, Group, Title } from "@mantine/core";
import { useParams } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";
import { firestore } from "@repo/firebase";
import { getAccessor } from "@zodapp/zod-firebase-browser";

import { tasksCollection } from "../../shared/taskManager/collections";
import { useStoreKey } from "../../shared/auth";
import {
  TestDataPanel,
  type TestDataSection,
} from "../../components/TestDataPanel";
import { useCodeViewerModal } from "../../components/useCodeViewerModal";
import { taskTestDataRoute } from "./testData.route";
import { populateSeed } from "./seed";

import pageCode from "./testData.tsx?raw";
import seedCode from "./seed.ts?raw";

/** 現状の挙動を維持する（30 件・100ms 間隔） */
const SEED_TASK_COUNT = 30;

const TaskTestDataPage = () => {
  const { workspaceId, projectId } = useParams({ from: taskTestDataRoute.id });
  const storeKey = useStoreKey();

  const taskAccessor = useMemo(
    () => getAccessor(firestore, tasksCollection, storeKey),
    [storeKey],
  );
  const collectionIdentity = useMemo(
    () => ({ workspaceId, projectId }),
    [workspaceId, projectId],
  );

  const seedTasks = useCallback(
    async ({
      count,
      report,
      isAborted,
    }: {
      count: number;
      report: (done: number) => void;
      isAborted: () => boolean;
    }) => {
      let done = 0;
      await new Promise<void>((resolve) => {
        void populateSeed(
          async (data) => {
            // 中止された場合は書き込みをスキップする（挙動は変えず、
            // UI からの中止だけを実現する）
            if (isAborted()) return;
            await taskAccessor.createDoc(collectionIdentity, data);
            done += 1;
            report(done);
          },
          count,
          () => resolve(),
        );
      });
    },
    [taskAccessor, collectionIdentity],
  );

  const sections = useMemo<TestDataSection[]>(
    () => [
      {
        kind: "repeatable",
        title: "タスク",
        description:
          "このプロジェクトにダミータスクを 100ms 間隔で追加します。実行するたびに増えるので、タスク一覧に戻ると GrowingList のリアルタイム更新と無限スクロールを確認できます。",
        defaultCount: SEED_TASK_COUNT,
        // 件数は従来どおり 30 件固定
        countEditable: false,
        run: seedTasks,
      },
    ],
    [seedTasks],
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
