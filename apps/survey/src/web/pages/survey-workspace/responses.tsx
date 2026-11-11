import {
  Title,
  Container,
  Group,
  Box,
  Menu,
  ActionIcon,
  Text,
  Badge,
} from "@mantine/core";
import {
  IconDotsVertical,
  IconDownload,
  IconFlask,
  IconSettings,
} from "@tabler/icons-react";
import { Link, useParams, useSearch, useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";
import { z } from "zod";
import { useApi } from "@zodapp/zod-dynamodb-react";
import { zf } from "@zodapp/zod-form";
import { extendSchemaSafe } from "@zodapp/zod-form-widget";
import {
  AutoTable,
  useAutoTableScroll,
  useTableSettingDrawer,
} from "@zodapp/zod-form-widget/table";
import { useExportModal } from "@zodapp/zod-form-widget/tabular";

import { responseSchema, type SurveyResponse } from "../../../shared";
import { buildSurveySchema } from "../../../shared/survey/buildSurveySchema";
import { fromStoredAnswers } from "../../../shared/survey/answers";
import type { Api } from "../../shared/api";
import { useOptionalSurvey } from "../../shared/hooks";
import { fetchAllPages, useFiltered, useListStore } from "../../shared/listing";
import { createDynamoExternalKeyResolver } from "../../shared/resolvers";
import { useLocalColumnSettings } from "../../shared/useLocalColumnSettings";
import { AutoSearch } from "../../components/AutoSearch";
import { FetchMore } from "../../components/FetchMore";
import { createMingoFilter } from "../../components/mingoQuery";
import { createActionSchema } from "../../components/createActionSchema";
import { useCodeViewerModal } from "../../components/useCodeViewerModal";
import { responsesRoute, searchFilterSchema } from "./responses.route";
import { responseDetailRoute } from "./response/detail.route";
import { surveyTestDataRoute } from "./testData.route";

import pageCode from "./responses.tsx?raw";
import collectionCode from "../../../shared/tables/response.ts?raw";

const PAGE_SIZE = 50;

/**
 * 表に出す行。アンケートを絞り込んでいるときは、日付の回答を Date に戻す。
 * 列は質問の定義から組み立てたスキーマで描くので、値の型もそれに合わせる
 * （保存の形の型 `answers: Record<string, string | number | boolean>` からは外れる）
 */
const toDisplayRows = (
  rows: SurveyResponse[],
  fields: unknown,
): SurveyResponse[] =>
  fields
    ? rows.map((row) => ({
        ...row,
        answers: fromStoredAnswers(fields, row.answers) as SurveyResponse["answers"],
      }))
    : rows;

const CROSS_SURVEY_DEFAULT_FIELD_PATHS = [
  "surveyId",
  "respondentId",
  "surveyRevision",
  "submittedAt",
  "_action",
];

/**
 * 回答一覧。
 *
 * 回答はアンケートの下ではなくワークスペースの直下にあるので、
 * 「ワークスペース内の全回答」を 1 つのクエリ（responses.all）で横断して表示できる。
 * アンケートで絞り込むと、Index（responses.bySurvey）で読み、そのアンケートの質問の定義から
 * 実行時に組み立てたスキーマで answers を展開する。列見出しに質問文が並ぶ。
 */
const ResponsesView = ({
  workspaceId,
  surveyId,
}: {
  workspaceId: string;
  surveyId: string | null;
}) => {
  const search = useSearch({ from: responsesRoute.id });
  const navigate = useNavigate({ from: responsesRoute.id });
  const api = useApi<Api>();

  const externalKeyResolvers = useMemo(
    () => [createDynamoExternalKeyResolver()],
    [],
  );
  const resolverContext = useMemo(
    () => ({ workspace: { workspaceId } }),
    [workspaceId],
  );

  // 絞り込み中のアンケートの定義（answers の列を実際のスキーマに差し替えるために使う）
  const surveyKey = useMemo(
    () => (surveyId ? { workspaceId, surveyId } : undefined),
    [workspaceId, surveyId],
  );
  const { item: survey } = useOptionalSurvey(surveyKey);
  const surveyFields = survey?.fields;

  const answersSchema = useMemo(() => {
    if (!surveyFields) return undefined;
    // AutoTable の列の抽出は、ラベルのないフィールドの配下を辿らないため、
    // 組み立てたオブジェクトにラベルを付けてから差し込む
    return buildSurveySchema(surveyFields).schema.register(zf.object.registry, {
      label: "回答",
    });
  }, [surveyFields]);

  // アンケートを絞り込んでいるときは、answers を実際の質問のスキーマで上書きする。
  // extendSchemaSafe は既存のキーの上書きだけを許すので、この用途に合う
  const tableSchema = useMemo(() => {
    const actionColumn = {
      _action: createActionSchema<SurveyResponse>({
        getParams: (item) => ({
          to: responseDetailRoute.to,
          params: { workspaceId, responseId: item.responseId },
        }),
      }),
    };
    if (!answersSchema) {
      return extendSchemaSafe(responseSchema, actionColumn);
    }
    return extendSchemaSafe(responseSchema, {
      answers: answersSchema.optional(),
      ...actionColumn,
    });
  }, [answersSchema, workspaceId]);

  const defaultFieldPaths = useMemo(() => {
    if (!answersSchema) return CROSS_SURVEY_DEFAULT_FIELD_PATHS;
    return [
      "respondentId",
      "submittedAt",
      ...Object.keys(answersSchema.shape).map((key) => `answers.${key}`),
      "_action",
    ];
  }, [answersSchema]);

  // アンケートの指定は Index で読み分け、回答日の範囲は読んだ一覧をブラウザで絞る。
  // どちらも live なので、別のタブで回答すると一覧にすぐ届く
  const listOptions = useMemo(() => ({ pageSize: PAGE_SIZE }), []);
  const list = useListStore<SurveyResponse>(
    () =>
      surveyId
        ? api.responses.bySurvey.live({ workspaceId, surveyId }, listOptions)
        : api.responses.all.live({ workspaceId }, listOptions),
    [api, workspaceId, surveyId, listOptions],
  );
  const clientConditions = useMemo(() => {
    const { surveyId: _surveyId, ...rest } = search.q ?? {};
    return rest;
  }, [search.q]);
  const clientFilter = useMemo(
    () => createMingoFilter(clientConditions),
    [clientConditions],
  );
  const filtered = useFiltered(list.items, clientFilter);

  // 保存した回答は日付を YYYY-MM-DD の文字列で持つので、表に出すときは Date に戻す
  const responses = useMemo(
    () => toDisplayRows(filtered, surveyFields),
    [filtered, surveyFields],
  );
  const isLoading = list.status === "loading" || list.isFetchingMore;

  const controller = useLocalColumnSettings({
    tableKey: surveyId ? `response:${surveyId}` : "response",
    schema: tableSchema,
    defaultFieldPaths,
  });

  const { open: openTableSetting, modal: tableSettingDrawer } =
    useTableSettingDrawer({ controller });

  const handleSearchChange = useCallback(
    (data: z.infer<typeof searchFilterSchema>) => {
      navigate({ search: { ...search, q: data } });
    },
    [navigate, search],
  );

  // CSV のエクスポートは、いまの条件で最後のページまで読む
  const fetchAllResponses = useCallback(async () => {
    const rows = await fetchAllPages(
      surveyId
        ? api.responses.bySurvey.pages({ workspaceId, surveyId })
        : api.responses.all.pages({ workspaceId }),
      clientFilter,
    );
    return toDisplayRows(rows, surveyFields);
  }, [api, workspaceId, surveyId, clientFilter, surveyFields]);

  const { open: openExport, modal: exportModal } = useExportModal({
    schema: tableSchema,
    data: responses,
    fetchAll: fetchAllResponses,
    filename: `responses-${surveyId ?? "all"}.csv`,
  });

  const {
    scrollParent,
    scrollParentRef,
    tableRef,
    bottomAnchorRef,
    handleFetchMore,
    scrollFab,
  } = useAutoTableScroll({
    itemCount: responses.length,
    isLoading,
    fetchMore: list.fetchMore,
  });

  const { trigger: codeViewerTrigger, modal: codeViewerModal } =
    useCodeViewerModal({ pageCode, collectionCode });

  return (
    <Container
      size="lg"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "calc(100dvh - 60px - var(--mantine-spacing-md) * 2)",
        overflow: "hidden",
      }}
    >
      <Group justify="space-between" mb="lg">
        <Group>
          <Title order={2}>回答一覧</Title>
          {survey ? (
            <Badge variant="light">{survey.title} で絞り込み中</Badge>
          ) : (
            <Badge variant="light" color="gray">
              全アンケート横断
            </Badge>
          )}
        </Group>
        <Group>
          {codeViewerTrigger}
          <Menu shadow="md" width={220} position="bottom-end">
            <Menu.Target>
              <ActionIcon variant="subtle" size="lg" aria-label="メニュー">
                <IconDotsVertical size={20} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>テーブル</Menu.Label>
              <Menu.Item
                leftSection={<IconSettings size={16} />}
                onClick={openTableSetting}
              >
                列設定
              </Menu.Item>
              <Menu.Divider />
              <Menu.Label>データ操作</Menu.Label>
              <Menu.Item
                leftSection={<IconDownload size={16} />}
                onClick={openExport}
              >
                CSVエクスポート
              </Menu.Item>
              <Menu.Item
                component={Link}
                to={surveyTestDataRoute.to}
                {...({ params: { workspaceId } } as object)}
                leftSection={<IconFlask size={16} />}
              >
                テストデータ
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Group>

      <Box
        mb="sm"
        px="sm"
        pb="md"
        style={{
          backgroundColor:
            "light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-6))",
          borderRadius: "8px",
        }}
      >
        <AutoSearch
          schema={searchFilterSchema}
          onChange={handleSearchChange}
          defaultValues={search.q}
          externalKeyResolvers={externalKeyResolvers}
          resolverContext={resolverContext}
        />
        {!surveyId && (
          <Text size="xs" c="dimmed" mt="xs">
            アンケートを選ぶと、その質問の定義から組み立てたスキーマで回答が列に展開されます。
          </Text>
        )}
      </Box>

      <div
        ref={scrollParentRef}
        style={{ overflow: "auto", flex: 1, minHeight: 0 }}
      >
        <AutoTable
          ref={tableRef}
          data={responses}
          keyField="responseId"
          sortable={false}
          controller={controller}
          externalKeyResolvers={externalKeyResolvers}
          resolverContext={resolverContext}
          scrollParent={scrollParent}
          virtualizeThreshold={50}
        />
        <div style={{ position: "sticky", left: 0, paddingBottom: "8px" }}>
          <FetchMore
            isLoading={isLoading}
            hasMore={list.hasMore}
            fetchMore={handleFetchMore}
            scannedCount={list.items.length}
            filteredCount={filtered.length}
            itemCount={responses.length}
            emptyWithMoreMessage="条件に一致する回答が見つかりませんでした"
            emptyNoMoreMessage="回答がまだありません。"
          />
        </div>
        <div ref={bottomAnchorRef} />
      </div>

      {scrollFab}
      {codeViewerModal}
      {exportModal}
      {tableSettingDrawer}
    </Container>
  );
};

const ResponsesPage = () => {
  const { workspaceId } = useParams({ from: responsesRoute.id });
  const search = useSearch({ from: responsesRoute.id });
  const surveyId = search.q?.surveyId ?? null;

  // スキーマが変わると列設定のコントローラーを作り直す必要があるため、
  // 絞り込むアンケートが変わったらビュー全体をマウントし直す
  return (
    <ResponsesView
      key={surveyId ?? "all"}
      workspaceId={workspaceId}
      surveyId={surveyId}
    />
  );
};

export default ResponsesPage;
