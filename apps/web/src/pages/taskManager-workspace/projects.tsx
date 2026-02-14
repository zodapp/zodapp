import {
  Title,
  Text,
  Container,
  Button,
  Group,
  Modal,
  Box,
  Loader,
  Center,
  Paper,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconPlus } from "@tabler/icons-react";
import { useParams, useSearch, useNavigate } from "@tanstack/react-router";
import { useState, useCallback, useMemo } from "react";
import { getAccessor } from "@zodapp/zod-firebase-browser";
import { firestore } from "@repo/firebase";
import { AutoTable } from "../../components/AutoTable";
import { createMingoFilter } from "../../components/mingoQuery";

import { z } from "zod";

import { useList } from "../../shared/taskManager/hooks";
import { projectsCollection } from "../../shared/taskManager/collections";
import { AutoForm } from "../../components/AutoForm";
import { AutoSearch } from "../../components/AutoSearch";
import { projectsRoute, searchFilterSchema } from "./projects.route";
import { tasksRoute } from "../taskManager-project/tasks.route";
import { CodeViewerModal } from "../../components/CodeViewerModal";

import pageCode from "./projects.tsx?raw";
import collectionCode from "../../shared/taskManager/collections/project.ts?raw";
import { zf } from "@zodapp/zod-form";

// テーブル表示用スキーマ
const projectTableSchema = projectsCollection.dataSchema
  .extend({}) // registerは破壊的なのでcopyしてからregisterする
  .register(zf.object.registry, {
    properties: ["name", "description", "status", "createdAt"],
  });

const ProjectsPage = () => {
  const { workspaceId } = useParams({
    from: projectsRoute.id,
  });
  const search = useSearch({
    from: projectsRoute.id,
  });
  const navigate = useNavigate({
    from: projectsRoute.id,
  });

  const pathParams = useMemo(() => ({ workspaceId }), [workspaceId]);

  // accessor を取得（queries が自動バインドされている）
  const projectAccessor = getAccessor(firestore, projectsCollection);

  // クライアントサイドフィルタ
  const clientFilter = useMemo(() => createMingoFilter(search.q), [search.q]);

  // サーバからのデータ取得 + クライアントフィルタ
  const { items: projects, isLoading } = useList({
    collection: projectsCollection,
    pathParams,
    query: {
      ...projectAccessor.queries.active.params(),
      orderBy: [{ field: "createdAt", direction: "desc" }],
    },
    clientFilter,
  });

  const [modalOpened, { open: openModal, close: closeModal }] =
    useDisclosure(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSearchChange = useCallback(
    (data: z.infer<typeof searchFilterSchema>) => {
      navigate({
        search: {
          ...search,
          q: data,
        },
      });
    },
    [navigate, search],
  );

  const getActionParams = useCallback(
    (item: z.infer<typeof projectsCollection.dataSchema>) => ({
      to: tasksRoute.to,
      params: { workspaceId, projectId: item.projectId },
    }),
    [workspaceId],
  );

  const handleCreate = useCallback(
    async (data: z.infer<typeof projectsCollection.createSchema>) => {
      setIsSubmitting(true);
      try {
        await projectAccessor.createDoc({ workspaceId }, data);
        closeModal();
      } catch (error) {
        console.error("Failed to create project:", error);
      } finally {
        setIsSubmitting(false);
      }
    },
    [projectAccessor, workspaceId, closeModal],
  );

  return (
    <Container size="lg">
      <Group justify="space-between" mb="lg">
        <Title order={2}>プロジェクト一覧</Title>
        <Group>
          <CodeViewerModal
            pageCode={pageCode}
            collectionCode={collectionCode}
          />
          <Button leftSection={<IconPlus size={16} />} onClick={openModal}>
            新規作成
          </Button>
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
          showPreview={true}
        />
      </Box>

      <AutoTable
        schema={projectTableSchema}
        data={projects}
        keyField="projectId"
        actionParams={getActionParams}
      />

      {!isLoading && projects.length === 0 && (
        <Paper p="xl" withBorder mt="sm">
          <Text c="dimmed" ta="center">
            {clientFilter
              ? "フィルタ条件に一致するプロジェクトが見つかりませんでした"
              : "プロジェクトがありません。新規作成してください。"}
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
        title="新規プロジェクト作成"
        size="calc(100vw - 3rem)"
      >
        <AutoForm
          schema={projectsCollection.createSchema}
          onSubmit={handleCreate}
          onCancel={closeModal}
          isLoading={isSubmitting}
          submitLabel="作成"
          defaultValues={projectsCollection.onInit?.()}
          showPreview={true}
        />
      </Modal>
    </Container>
  );
};

export default ProjectsPage;
