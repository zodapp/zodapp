import {
  Title,
  Text,
  Container,
  Group,
  Modal,
  Loader,
  Center,
  Paper,
  ActionIcon,
  Tooltip,
  Menu,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconPlus,
  IconDotsVertical,
  IconDownload,
  IconUpload,
  IconSettings,
} from "@tabler/icons-react";
import { useParams } from "@tanstack/react-router";
import { useState, useCallback, useMemo } from "react";
import { useApi } from "@zodapp/zod-dynamodb-react";
import {
  AutoTable,
  useTableSettingDrawer,
} from "@zodapp/zod-form-widget/table";
import { extendSchemaSafe } from "@zodapp/zod-form-widget";
import { useLocalColumnSettings } from "../../shared/useLocalColumnSettings";
import { createActionSchema } from "../../components/createActionSchema";
import {
  useExportModal,
  useImportModal,
} from "@zodapp/zod-form-widget/tabular";
import { fetchAllPages } from "../../shared/listing";
import type { Api } from "../../shared/api";

import { z } from "zod";

import { useMembers } from "../../shared/hooks";
import { memberCreateSchema, memberSchema } from "../../../shared";
import { AutoForm } from "../../components/AutoForm";
import { membersRoute } from "./members.route";
import { memberDetailRoute } from "./member/detail.route";
import { useCodeViewerModal } from "../../components/useCodeViewerModal";

import pageCode from "./members.tsx?raw";
import collectionCode from "../../../shared/tables/member.ts?raw";

const MEMBER_TABLE_STORAGE_KEY = "tableSetting-member";
const MEMBER_TABLE_DEFAULT_FIELD_PATHS = [
  "displayName",
  "email",
  "role",
  "createdAt",
  "updatedAt",
  "_action",
];

type MemberData = z.infer<typeof memberSchema>;
type MemberInput = z.infer<typeof memberCreateSchema>;

const MembersPage = () => {
  const { workspaceId } = useParams({
    from: membersRoute.id,
  });

  const memberTableSchema = useMemo(
    () =>
      extendSchemaSafe(memberSchema, {
        _action: createActionSchema<MemberData>({
          getParams: (item) => ({
            to: memberDetailRoute.to,
            // メンバーのキーは email（zodapp でもドキュメント ID は email）
            params: { workspaceId, memberId: item.email },
          }),
        }),
      }),
    [workspaceId],
  );

  const api = useApi<Api>();
  const resolverContext = useMemo(
    () => ({ workspace: { workspaceId } }),
    [workspaceId],
  );

  // メンバー一覧（リアルタイムで購読する）
  const listParams = useMemo(() => ({ workspaceId }), [workspaceId]);
  const list = useMembers(listParams);
  const members = list.items;
  const isLoading = list.status === "loading";

  const [modalOpened, { open: openModal, close: closeModal }] =
    useDisclosure(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreate = useCallback(
    async ({ email, ...data }: MemberInput) => {
      setIsSubmitting(true);
      try {
        await api.members.add({ workspaceId, email: email.toLowerCase() }, data);
        closeModal();
      } catch (error) {
        console.error("Failed to create member:", error);
      } finally {
        setIsSubmitting(false);
      }
    },
    [api, workspaceId, closeModal],
  );

  const fetchAllMembers = useCallback(
    () => fetchAllPages(api.members.list.pages(listParams)),
    [api, listParams],
  );

  const { open: openExport, modal: exportModal } = useExportModal({
    schema: memberSchema,
    data: members,
    fetchAll: fetchAllMembers,
    filename: `members-${workspaceId}.csv`,
  });

  const handleImport = useCallback(
    async (rows: MemberInput[]) => {
      for (const { email, ...row } of rows) {
        await api.members.add({ workspaceId, email: email.toLowerCase() }, row);
      }
    },
    [api, workspaceId],
  );

  const { open: openImport, modal: importModal } = useImportModal({
    schema: memberCreateSchema,
    onImport: handleImport,
  });

  // 列設定（このブラウザに保存する）
  const controller = useLocalColumnSettings({
    tableKey: MEMBER_TABLE_STORAGE_KEY,
    schema: memberTableSchema,
    defaultFieldPaths: MEMBER_TABLE_DEFAULT_FIELD_PATHS,
  });

  const { open: openTableSetting, modal: tableSettingDrawer } =
    useTableSettingDrawer({
      controller,
    });

  const { trigger: codeViewerTrigger, modal: codeViewerModal } =
    useCodeViewerModal({ pageCode, collectionCode });

  return (
    <Container size="lg">
      <Group justify="space-between" mb="lg">
        <Title order={2}>メンバー一覧</Title>
        <Group>
          {codeViewerTrigger}
          <Tooltip label="新規追加">
            <ActionIcon
              aria-label="新規追加"
              variant="filled"
              size="lg"
              radius="xl"
              onClick={openModal}
            >
              <IconPlus size={20} />
            </ActionIcon>
          </Tooltip>
          <Menu shadow="md" width={200} position="bottom-end">
            <Menu.Target>
              <ActionIcon variant="subtle" size="lg">
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
                leftSection={<IconUpload size={16} />}
                onClick={openImport}
              >
                CSVインポート
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Group>

      <AutoTable data={members} keyField="email" controller={controller} />
      {!isLoading && members.length === 0 && (
        <Paper p="xl" withBorder mt="sm">
          <Text c="dimmed" ta="center">
            メンバーがいません。新規追加してください。
          </Text>
        </Paper>
      )}
      {isLoading && (
        <Center h={200}>
          <Loader />
        </Center>
      )}

      <Modal
        opened={modalOpened}
        onClose={closeModal}
        title="メンバー追加"
        size="calc(100vw - 3rem)"
      >
        <AutoForm
          schema={memberCreateSchema}
          onSubmit={handleCreate}
          onCancel={closeModal}
          isLoading={isSubmitting}
          submitLabel="追加"
          resolverContext={resolverContext}
          showPreview={true}
        />
      </Modal>

      {codeViewerModal}
      {exportModal}
      {importModal}
      {tableSettingDrawer}
    </Container>
  );
};

export default MembersPage;
