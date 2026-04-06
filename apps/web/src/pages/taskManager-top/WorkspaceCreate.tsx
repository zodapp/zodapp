import { useState, useCallback, useMemo } from "react";
import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import {
  Stepper,
  Stack,
  Text,
  Group,
  Button,
  SegmentedControl,
} from "@mantine/core";
import { getAccessor } from "@zodapp/zod-firebase-browser";
import { firestore } from "@repo/firebase";
import { hideSchemaFields } from "@zodapp/zod-form-widget";

import { AutoForm } from "@zodapp/zod-form-widget/form";
import { ImportPanel } from "@zodapp/zod-form-widget/tabular";
import {
  workspacesCollection,
  membersCollection,
} from "../../shared/taskManager/collections";
import { useStoreKey } from "../../shared/auth";
import type {
  WorkspaceOwnerInfo,
  WorkspaceCreateData,
} from "./utils/userWorkspace";

const memberCreateSchema = hideSchemaFields(membersCollection.createSchema, {
  paths: ["avatarImage"],
});

const workspaceStepSchema = z
  .object({ workspace: workspacesCollection.createSchema })
  .register(zf.object.registry, {});

const memberStepSchema = z
  .object({
    members: z
      .array(memberCreateSchema)
      .register(zf.array.registry, { label: "追加メンバー" }),
  })
  .register(zf.object.registry, {});

const workspaceCreateDraftSchema = z
  .object({
    workspace: workspacesCollection.createSchema,
    members: z
      .array(memberCreateSchema)
      .register(zf.array.registry, { label: "追加メンバー" }),
  })
  .register(zf.object.registry, {});

type Draft = z.infer<typeof workspaceCreateDraftSchema>;
type WorkspaceStepData = z.infer<typeof workspaceStepSchema>;
type MemberStepData = z.infer<typeof memberStepSchema>;
type MemberInputMode = "direct" | "file";

type Props = {
  userEmail: string;
  userDisplayName: string;
  createWorkspaceWithOwner: (
    data: WorkspaceCreateData,
    owner: WorkspaceOwnerInfo,
  ) => Promise<string>;
  onCreated: (workspaceId: string) => void;
  onCancel: () => void;
};

export function WorkspaceCreate({
  userEmail,
  userDisplayName,
  createWorkspaceWithOwner,
  onCreated,
  onCancel,
}: Props) {
  const storeKey = useStoreKey();
  const [activeStep, setActiveStep] = useState(0);
  const [memberInputMode, setMemberInputMode] =
    useState<MemberInputMode>("direct");
  const [isSaving, setIsSaving] = useState(false);
  const [draft, setDraft] = useState<Draft>({
    workspace: { name: "", ownerId: userEmail },
    members: [],
  });

  const memberAccessor = useMemo(
    () => getAccessor(firestore, membersCollection, storeKey),
    [storeKey],
  );

  const handleWorkspaceSubmit = useCallback((value: WorkspaceStepData) => {
    setDraft((prev) => ({ ...prev, workspace: value.workspace }));
    setActiveStep(1);
  }, []);

  const handleMemberSubmit = useCallback((value: MemberStepData) => {
    setDraft((prev) => ({ ...prev, members: value.members }));
    setActiveStep(2);
  }, []);

  const handleConfirmSubmit = useCallback(
    async (value: Draft) => {
      setIsSaving(true);
      try {
        const workspaceId = await createWorkspaceWithOwner(value.workspace, {
          email: userEmail,
          displayName: userDisplayName,
        });

        if (value.members.length > 0) {
          await Promise.all(
            value.members.map((member) =>
              memberAccessor.createDoc({ workspaceId }, member),
            ),
          );
        }

        onCreated(workspaceId);
      } catch (error) {
        console.error("Failed to create workspace:", error);
      } finally {
        setIsSaving(false);
      }
    },
    [
      createWorkspaceWithOwner,
      userEmail,
      userDisplayName,
      memberAccessor,
      onCreated,
    ],
  );

  return (
    <Stack gap="lg" p="md">
      <Stepper active={activeStep} allowNextStepsSelect={false}>
        <Stepper.Step label="基本情報" description="ワークスペース情報" />
        <Stepper.Step label="メンバー" description="メンバーを追加" />
        <Stepper.Step label="確認" description="内容を確認して作成" />
      </Stepper>

      {activeStep === 0 && (
        <AutoForm
          schema={workspaceStepSchema}
          defaultValues={draft}
          onSubmit={handleWorkspaceSubmit}
          onCancel={onCancel}
          submitLabel="次へ"
        />
      )}

      {activeStep === 1 && (
        <Stack gap="md">
          <SegmentedControl
            value={memberInputMode}
            onChange={(value) => {
              if (value === "direct" || value === "file") {
                setMemberInputMode(value);
              }
            }}
            data={[
              { value: "direct", label: "直接入力" },
              { value: "file", label: "ファイル取り込み" },
            ]}
          />

          {memberInputMode === "direct" ? (
            <AutoForm
              schema={memberStepSchema}
              defaultValues={draft}
              onSubmit={handleMemberSubmit}
              onCancel={(value) => {
                setDraft((prev) => ({ ...prev, members: (value as MemberStepData).members }));
                setActiveStep(0);
              }}
              cancelLabel="戻る"
              submitLabel="次へ"
            />
          ) : (
            <ImportPanel
              schema={memberCreateSchema}
              onImport={(rows) => {
                setDraft((prev) => ({ ...prev, members: rows }));
                setActiveStep(2);
              }}
              renderFooter={({ executeImport, isImporting, rowCount }) => (
                <Group justify="flex-end" mt="md">
                  <Button variant="default" onClick={() => setActiveStep(0)}>
                    戻る
                  </Button>
                  <Button
                    onClick={executeImport}
                    loading={isImporting}
                    disabled={rowCount === 0}
                  >
                    次へ
                  </Button>
                </Group>
              )}
            />
          )}
        </Stack>
      )}

      {activeStep === 2 && (
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            内容を確認して「作成」を押すと、ワークスペースとメンバーをまとめて登録します。
          </Text>
          <AutoForm
            schema={workspaceCreateDraftSchema}
            defaultValues={draft}
            readOnly
          />
          <Group justify="flex-end" mt="md">
            <Button
              variant="default"
              onClick={() => setActiveStep(1)}
              disabled={isSaving}
            >
              戻る
            </Button>
            <Button
              onClick={() => handleConfirmSubmit(draft)}
              loading={isSaving}
            >
              作成
            </Button>
          </Group>
        </Stack>
      )}
    </Stack>
  );
}
