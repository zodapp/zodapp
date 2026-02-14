import { Modal, Tabs, ActionIcon, Tooltip } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { CodeHighlight } from "@mantine/code-highlight";
import { IconCode } from "@tabler/icons-react";

import "@mantine/code-highlight/styles.css";

export interface CodeViewerModalProps {
  pageCode: string;
  collectionCode: string;
}

/**
 * コードビューアモーダルを開くアイコンボタンとモーダル本体を提供するコンポーネント
 */
export const CodeViewerModal = ({
  pageCode,
  collectionCode,
}: CodeViewerModalProps) => {
  const [opened, { open, close }] = useDisclosure(false);

  return (
    <>
      <Tooltip label="コードを見る">
        <ActionIcon variant="subtle" size="lg" onClick={open}>
          <IconCode size={20} />
        </ActionIcon>
      </Tooltip>

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
    </>
  );
};
