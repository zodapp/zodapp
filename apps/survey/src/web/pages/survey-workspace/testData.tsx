import { Button, Container, Group, Select, Title, Text } from "@mantine/core";
import { IconExternalLink } from "@tabler/icons-react";
import { Link, useParams } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import { useApi } from "@zodapp/zod-dynamodb-react";

import type { Survey } from "../../../shared";
import { toStoredAnswers } from "../../../shared/survey/answers";
import {
  buildSurveyFixturePath,
  surveyFixtures,
} from "../../../shared/survey/fixtures";
import { generateDummyAnswers } from "../../../shared/survey/generateDummyAnswers";
import type { Api } from "../../shared/api";
import { postJson } from "../../shared/api";
import { useActiveSurveys, useMembers } from "../../shared/hooks";
import {
  TestDataPanel,
  type TestDataRunContext,
  type TestDataSection,
} from "../../components/TestDataPanel";
import { useCodeViewerModal } from "../../components/useCodeViewerModal";
import { surveyTestDataRoute } from "./testData.route";
import { surveyAnswerRoute } from "../survey-public/answer.route";

import pageCode from "./testData.tsx?raw";
import fixturesCode from "../../../shared/survey/fixtures.ts?raw";

/** 1 件ずつ投入するときの間隔 */
const RESPONSE_INTERVAL_MS = 150;
/** サーバーの /test-data/responses が 1 回に受け付ける上限 */
const BULK_CHUNK = 500;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const SurveyTestDataPage = () => {
  const { workspaceId } = useParams({ from: surveyTestDataRoute.id });
  const api = useApi<Api>();
  const workspaceParams = useMemo(() => ({ workspaceId }), [workspaceId]);

  // 回答の投入先（有効なアンケートから選ぶ。既定は公開中の最初のもの）
  const { items: surveys } = useActiveSurveys(workspaceParams);
  const [targetSurveyId, setTargetSurveyId] = useState<string | null>(null);
  const targetSurvey = useMemo(
    () =>
      surveys.find((survey) => survey.surveyId === targetSurveyId) ??
      surveys.find((survey) => survey.status === "published"),
    [surveys, targetSurveyId],
  );

  // 回答者は、ワークスペースのメンバーから順に割り当てる
  const { items: members } = useMembers(workspaceParams);

  const seedSurveys = useCallback(async () => {
    for (const fixture of surveyFixtures) {
      const key = { workspaceId, surveyId: fixture.surveyId };
      await api.surveys.put(key, { ...fixture.data, ...key });
    }
  }, [api, workspaceId]);

  const clearSurveys = useCallback(async () => {
    for (const fixture of surveyFixtures) {
      await api.surveys.remove({ workspaceId, surveyId: fixture.surveyId });
    }
  }, [api, workspaceId]);

  /** index 番目のダミー回答。回答日時を過去にばらけさせると、日付の範囲の検索を確かめやすい */
  const buildResponse = useCallback(
    (survey: Survey, index: number) => {
      const { answers } = generateDummyAnswers(survey.fields, index);
      const respondent = members[index % Math.max(1, members.length)];
      const submittedAt = new Date();
      submittedAt.setMinutes(submittedAt.getMinutes() - index * 37);
      return {
        surveyId: survey.surveyId,
        surveyRevision: survey.revision,
        respondentId: respondent?.email,
        answers: toStoredAnswers(survey.fields, answers),
        submittedAt,
      };
    },
    [members],
  );

  // 1 件ずつ API で作る。回答一覧を開いた別のタブに、1 件ずつ届くのが見える
  const seedOneByOne = useCallback(
    async ({ count, report, isAborted }: TestDataRunContext) => {
      if (!targetSurvey) return;
      for (let index = 0; index < count; index += 1) {
        if (isAborted()) return;
        await api.responses.create(
          workspaceParams,
          buildResponse(targetSurvey, index),
        );
        report(index + 1);
        await wait(RESPONSE_INTERVAL_MS);
      }
    },
    [api, targetSurvey, workspaceParams, buildResponse],
  );

  // 件数が多いときは、サーバーのルートが bulkWrite でまとめて書く
  const seedBulk = useCallback(
    async ({ count, report, isAborted }: TestDataRunContext) => {
      if (!targetSurvey) return;
      let done = 0;
      while (done < count) {
        if (isAborted()) return;
        const size = Math.min(BULK_CHUNK, count - done);
        const responses = Array.from({ length: size }, (_, i) =>
          buildResponse(targetSurvey, done + i),
        );
        await postJson("/test-data/responses", { workspaceId, responses });
        done += size;
        report(done);
      }
    },
    [targetSurvey, workspaceId, buildResponse],
  );

  const surveySelector = (
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
          // 回答ページは別のタブで開く。このページを残したまま手で回答して、
          // ダミー回答と混ざる様子を確かめられる
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
  );

  const disabledReason =
    "投入先のアンケートがありません。先に「アンケート定義」を投入してください。";

  const sections: TestDataSection[] = [
    {
      kind: "idempotent",
      title: "アンケート定義",
      description:
        "公開中・下書き・削除済みの 3 件を固定の ID で投入します。再投入は上書きなので増えません。テスト（tables.spec.ts）と同じ定義を使っています。",
      targets: surveyFixtures.map((fixture) =>
        buildSurveyFixturePath(workspaceId, fixture.surveyId),
      ),
      run: seedSurveys,
      clear: clearSurveys,
    },
    {
      kind: "repeatable",
      title: "回答（1 件ずつ）",
      description:
        "選んだアンケートの質問の定義からダミー回答を作り、150ms 間隔で追加します。回答一覧を別のタブで開いておくと、リアルタイムに増えていくのを確かめられます。",
      defaultCount: 20,
      extraControls: surveySelector,
      disabled: !targetSurvey,
      disabledReason,
      run: seedOneByOne,
    },
    {
      kind: "repeatable",
      title: "回答（まとめて）",
      description:
        "サーバーの bulkWrite でダミー回答をまとめて追加します。回答一覧のページングを確かめるときに使います。",
      defaultCount: 200,
      countEditable: true,
      disabled: !targetSurvey,
      disabledReason,
      run: seedBulk,
    },
  ];

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
            投入したアンケートは「回答ページを開く」から別のタブで実際に回答できます。
            ダミー回答と手で入れた回答が同じ一覧に並びます。
          </Text>
        }
      />

      {codeViewerModal}
    </Container>
  );
};

export default SurveyTestDataPage;
