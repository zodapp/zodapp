import type { ReactNode } from "react";
import { Modal, Tabs, ActionIcon, Tooltip } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { CodeHighlight } from "@mantine/code-highlight";
import { IconCode } from "@tabler/icons-react";

import "@mantine/code-highlight/styles.css";

export interface CodeViewerModalProps {
  pageCode: string;
  collectionCode: string;
}

export function useCodeViewerModal({
  pageCode,
  collectionCode,
}: CodeViewerModalProps): { trigger: ReactNode; modal: ReactNode } {
  const [opened, { open, close }] = useDisclosure(false);

  const trigger = (
    <Tooltip label="コードを見る">
      <ActionIcon variant="subtle" size="lg" onClick={open}>
        <IconCode size={20} />
      </ActionIcon>
    </Tooltip>
  );

  const modal = (
    <Modal
      opened={opened}
      onClose={close}
      title="ソースコード"
      size="calc(100vw - 3rem)"
    >
      <Tabs defaultValue="page">
        <Tabs.List>
          <Tabs.Tab value="page">ページ</Tabs.Tab>
          <Tabs.Tab value="collection">コレクション</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="page" pt="md">
          <CodeHighlight
            code={pageCode}
            language="typescript"
            withCopyButton
          />
        </Tabs.Panel>

        <Tabs.Panel value="collection" pt="md">
          <CodeHighlight
            code={collectionCode}
            language="typescript"
            withCopyButton
          />
        </Tabs.Panel>
      </Tabs>
    </Modal>
  );

  return { trigger, modal };
}
