import { Button, Container, Group, Select, Title, Text } from "@mantine/core";
import { IconExternalLink } from "@tabler/icons-react";
import { Link, useParams } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import { firestore } from "@repo/firebase";
import { getAccessor } from "@zodapp/zod-firebase-browser";

import {
  responsesCollection,
  surveyQueries,
  surveysCollection,
} from "../../shared/survey/collections";
import {
  buildSurveyFixturePath,
  surveyFixtures,
} from "../../shared/survey/fixtures";
import { generateDummyAnswers } from "../../shared/survey/generateDummyAnswers";
import { useList } from "../../shared/taskManager/hooks";
import { memberQueries, membersCollection } from "../../shared/taskManager/collections";
import { useStoreKey } from "../../shared/auth";
import {
  TestDataPanel,
  type TestDataSection,
} from "../../components/TestDataPanel";
import { useCodeViewerModal } from "../../components/useCodeViewerModal";
import { surveyTestDataRoute } from "./testData.route";
import { surveyAnswerRoute } from "../survey-public/answer.route";

import pageCode from "./testData.tsx?raw";
import fixturesCode from "../../shared/survey/fixtures.ts?raw";

const RESPONSE_INTERVAL_MS = 150;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const SurveyTestDataPage = () => {
  const { workspaceId } = useParams({ from: surveyTestDataRoute.id });
  const storeKey = useStoreKey();

  const surveyAccessor = useMemo(
    () => getAccessor(firestore, surveysCollection, storeKey),
    [storeKey],
  );
  const responseAccessor = useMemo(
    () => getAccessor(firestore, responsesCollection, storeKey),
    [storeKey],
  );

  const collectionIdentity = useMemo(() => ({ workspaceId }), [workspaceId]);

  // 回答の投入先（公開中のアンケートから選ぶ）
  const { items: surveys } = useList({
    collection: surveysCollection,
    collectionIdentity,
    query: surveyQueries.queries.active(),
  });
  const [targetSurveyId, setTargetSurveyId] = useState<string | null>(null);
  const targetSurvey = useMemo(
    () =>
      surveys.find((survey) => survey.surveyId === targetSurveyId) ??
      surveys.find((survey) => survey.status === "published"),
    [surveys, targetSurveyId],
  );

  // 回答者はワークスペースのメンバーからランダムに割り当てる
  const { items: members } = useList({
    collection: membersCollection,
    collectionIdentity,
    query: memberQueries.queries.all(),
  });

  const seedSurveys = useCallback(async () => {
    for (const fixture of surveyFixtures) {
      await surveyAccessor.setDoc(
        { workspaceId, surveyId: fixture.surveyId },
        fixture.data,
      );
    }
  }, [surveyAccessor, workspaceId]);

  const clearSurveys = useCallback(async () => {
    for (const fixture of surveyFixtures) {
      await surveyAccessor.deleteDoc({
        workspaceId,
        surveyId: fixture.surveyId,
      });
    }
  }, [surveyAccessor, workspaceId]);

  const seedResponses = useCallback(
    async ({
      count,
      report,
      isAborted,
    }: {
      count: number;
      report: (done: number) => void;
      isAborted: () => boolean;
    }) => {
      if (!targetSurvey) return;
      for (let index = 0; index < count; index += 1) {
        if (isAborted()) return;
        const { answers } = generateDummyAnswers(targetSurvey.fields, index);
        const respondent = members[index % Math.max(1, members.length)];
        // 回答日時を過去にばらけさせると、日付範囲検索やストリーム更新を
        // 確認しやすい（responses の onCreate は指定値を尊重する）
        const submittedAt = new Date();
        submittedAt.setMinutes(submittedAt.getMinutes() - index * 37);

        await responseAccessor.createDoc(collectionIdentity, {
          surveyId: targetSurvey.surveyId,
          surveyRevision: targetSurvey.revision,
          respondentId: respondent?.memberId,
          answers,
          submittedAt,
        });
        report(index + 1);
        await wait(RESPONSE_INTERVAL_MS);
      }
    },
    [targetSurvey, members, responseAccessor, collectionIdentity],
  );

  const sections = useMemo<TestDataSection[]>(
    () => [
      {
        kind: "idempotent",
        title: "アンケート定義",
        description:
          "公開中・下書き・削除済みの 3 件を固定 ID で投入します。再投入は上書きなので増えません。CI のルールテストと同じ定義を使っています。",
        targets: surveyFixtures.map((fixture) =>
          buildSurveyFixturePath(workspaceId, fixture.surveyId),
        ),
        run: seedSurveys,
        clear: clearSurveys,
      },
      {
        kind: "repeatable",
        title: "回答",
        description:
          "選択したアンケートの質問定義からダミー回答を生成して追加します。実行するたびに増えるので、回答一覧を開くと GrowingList のリアルタイム更新と無限スクロールを確認できます。",
        defaultCount: 20,
        extraControls: (
          <Group align="flex-end" gap="sm">
            <Select
              label="投入先のアンケート"
              placeholder="アンケートを選択"
              data={surveys.map((survey) => ({
                value: survey.surveyId,
                label: survey.title,
              }))}
              value={targetSurvey?.surveyId ?? null}
              onChange={setTargetSurveyId}
              w={320}
            />
            {targetSurvey && (
              <Button
                component={Link}
                to={surveyAnswerRoute.to}
                // 回答ページは別タブで開く。このページを残したまま手で回答して、
                // ダミー回答と混ざる様子を確認できる
                target="_blank"
                {...({
                  params: { workspaceId, surveyId: targetSurvey.surveyId },
                } as object)}
                variant="default"
                leftSection={<IconExternalLink size={16} />}
              >
                回答ページを開く
              </Button>
            )}
          </Group>
        ),
        disabled: !targetSurvey,
        disabledReason:
          "投入先のアンケートがありません。先に「アンケート定義」を投入してください。",
        run: seedResponses,
      },
    ],
    [
      workspaceId,
      seedSurveys,
      clearSurveys,
      seedResponses,
      surveys,
      targetSurvey,
    ],
  );

  const { trigger: codeViewerTrigger, modal: codeViewerModal } =
    useCodeViewerModal({ pageCode, collectionCode: fixturesCode });

  return (
    <Container size="md">
      <Group justify="space-between" mb="lg">
        <Title order={2}>テストデータ</Title>
        {codeViewerTrigger}
      </Group>

      <TestDataPanel
        sections={sections}
        note={
          <Text size="sm" mt={4}>
            投入したアンケートは「回答ページを開く」から別タブで実際に回答できます。
            ダミー回答と手入力の回答が同じ一覧に並びます。
          </Text>
        }
      />

      {codeViewerModal}
    </Container>
  );
};

export default SurveyTestDataPage;
