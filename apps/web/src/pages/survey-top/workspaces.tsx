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
import { IconPlus, IconDotsVertical, IconSettings } from "@tabler/icons-react";
import { useCallback, useMemo } from "react";
import {
  AutoTable,
  useTableSettingDrawer,
} from "@zodapp/zod-form-widget/table";
import { extendSchemaSafe } from "@zodapp/zod-form-widget";

import { z } from "zod";

// ワークスペース（テナント）は taskManager と同じ仕組み・同じデータを共用する。
// 「同一のテナント基盤の上に複数アプリを載せる」構成のサンプルでもある
import { workspacesCollection } from "../../shared/taskManager/collections";
import { useProfileColumnSettings } from "../../shared/taskManager/useProfileColumnSettings";
import { useUserWorkspaces } from "../taskManager-top/utils/userWorkspace";
import { WorkspaceCreate } from "../taskManager-top/WorkspaceCreate";
import { surveysRoute } from "../survey-workspace/surveys.route";
import { useCodeViewerModal } from "../../components/useCodeViewerModal";
import { createActionSchema } from "../../components/createActionSchema";
import { useAuthContext } from "../../shared/auth";

import pageCode from "./workspaces.tsx?raw";
import collectionCode from "../../shared/taskManager/collections/workspace.ts?raw";

const WORKSPACE_TABLE_STORAGE_KEY = "survey-workspace";
const WORKSPACE_TABLE_DEFAULT_FIELD_PATHS = [
  "name",
  "description",
  "createdAt",
  "_action",
];

type WorkspaceData = z.infer<typeof workspacesCollection.dataSchema>;

const SurveyWorkspacesPage = () => {
  const { user } = useAuthContext();
  const userEmail = user?.email;

  const {
    workspaces,
    isLoading,
    refetch: fetchUserWorkspaces,
    createWorkspaceWithOwner,
  } = useUserWorkspaces(userEmail);

  const workspaceTableSchema = useMemo(
    () =>
      extendSchemaSafe(workspacesCollection.dataSchema, {
        _action: createActionSchema<WorkspaceData>({
          getParams: (item) => ({
            to: surveysRoute.to,
            params: { workspaceId: item.workspaceId },
          }),
        }),
      }),
    [],
  );

  const controller = useProfileColumnSettings({
    tableKey: WORKSPACE_TABLE_STORAGE_KEY,
    schema: workspaceTableSchema,
    defaultFieldPaths: WORKSPACE_TABLE_DEFAULT_FIELD_PATHS,
  });

  const { open: openTableSetting, modal: tableSettingDrawer } =
    useTableSettingDrawer({ controller });

  const { trigger: codeViewerTrigger, modal: codeViewerModal } =
    useCodeViewerModal({ pageCode, collectionCode });

  const [modalOpened, { open: openModal, close: closeModal }] =
    useDisclosure(false);

  const handleCreated = useCallback(async () => {
    closeModal();
    await fetchUserWorkspaces();
  }, [closeModal, fetchUserWorkspaces]);

  if (!userEmail) {
    return (
      <Center h={200}>
        <Text>
          ログイン情報が取得できませんでした。ログインしなおしてください。
        </Text>
      </Center>
    );
  }

  return (
    <Container size="lg">
      <Group justify="space-between" mb="lg">
        <Title order={2}>ワークスペース一覧</Title>
        <Group>
          {codeViewerTrigger}
          <Tooltip label="新規作成">
            <ActionIcon
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
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Group>

      <AutoTable
        data={workspaces}
        keyField="workspaceId"
        controller={controller}
      />
      {!isLoading && workspaces.length === 0 && (
        <Paper p="xl" withBorder mt="sm">
          <Text c="dimmed" ta="center">
            ワークスペースがありません。新規作成してください。
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
        title="新規ワークスペース作成"
        size="calc(100vw - 3rem)"
      >
        <WorkspaceCreate
          userEmail={userEmail}
          userDisplayName={user?.displayName || userEmail}
          createWorkspaceWithOwner={createWorkspaceWithOwner}
          onCreated={handleCreated}
          onCancel={closeModal}
        />
      </Modal>

      {codeViewerModal}
      {tableSettingDrawer}
    </Container>
  );
};

export default SurveyWorkspacesPage;
