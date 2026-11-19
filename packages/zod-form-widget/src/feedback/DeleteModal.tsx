import { Alert, Button, Group, Menu, Modal, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconTrash } from '@tabler/icons-react';
import { useCallback, useState } from 'react';
import type { ReactNode } from 'react';
import { useMsg } from '../messages/useMsg';

type UseDeleteModalProps = {
  title?: string;
  message: ReactNode;
  confirmLabel?: string;
  onDelete: () => Promise<void> | void;
};

export function useDeleteModal({
  title: titleFromProps,
  message,
  confirmLabel: confirmLabelFromProps,
  onDelete
}: UseDeleteModalProps) {
  const msg = useMsg();
  const title = titleFromProps ?? msg('zodFormWidget.delete.title' /* i18n: 削除確認 */);
  const confirmLabel =
    confirmLabelFromProps ?? msg('zodFormWidget.delete.confirm' /* i18n: 削除する */);
  const [opened, { open, close }] = useDisclosure(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = useCallback(() => {
    if (isDeleting) {
      return;
    }
    setError(null);
    close();
  }, [close, isDeleting]);

  const handleDelete = useCallback(async () => {
    setIsDeleting(true);
    setError(null);
    try {
      await onDelete();
      close();
    } catch (e) {
      setError(
        e instanceof Error
          ? msg.resolve(e.message)
          : msg('zodFormWidget.delete.failed' /* i18n: 削除に失敗しました。 */)
      );
    } finally {
      setIsDeleting(false);
    }
  }, [close, msg, onDelete]);

  const modal = (
    <Modal opened={opened} onClose={handleClose} title={title} centered>
      <Text size="sm">{message}</Text>
      {error && (
        <Alert color="red" mt="md">
          {error}
        </Alert>
      )}
      <Group justify="flex-end" mt="lg">
        <Button variant="default" onClick={handleClose} disabled={isDeleting}>
          {msg('zodFormWidget.common.cancel' /* i18n: キャンセル */)}
        </Button>
        <Button
          color="red"
          leftSection={<IconTrash size={16} />}
          onClick={handleDelete}
          loading={isDeleting}
        >
          {confirmLabel}
        </Button>
      </Group>
    </Modal>
  );

  return { open, modal, isDeleting };
}

type DeleteMenuItemProps = {
  label?: string;
  onClick: () => void;
};

export function DeleteMenuItem({ label, onClick }: DeleteMenuItemProps) {
  const msg = useMsg();
  return (
    <Menu.Item color="red" leftSection={<IconTrash size={16} />} onClick={onClick}>
      {label ?? msg('zodFormWidget.delete.menuItem' /* i18n: 削除 */)}
    </Menu.Item>
  );
}
