import type { ButtonProps } from '@mantine/core';
import type { z } from 'zod';

export type AutoFormAction<T extends z.ZodTypeAny> =
  | {
      type: 'submit';
      label: string;
      onSubmit: (data: z.output<T>) => void;
      variant?: ButtonProps['variant'];
      color?: ButtonProps['color'];
      disabled?: boolean;
      loading?: boolean;
    }
  | {
      type: 'cancel';
      label: string;
      onCancel: (data: z.input<T>) => void;
      variant?: ButtonProps['variant'];
      color?: ButtonProps['color'];
      disabled?: boolean;
      loading?: boolean;
    }
  | {
      type: 'custom';
      label: string;
      onClick: (context: { values: z.input<T> }) => void;
      variant?: ButtonProps['variant'];
      color?: ButtonProps['color'];
      disabled?: boolean;
      loading?: boolean;
    };

export type NormalizeAutoFormActionsOptions<T extends z.ZodTypeAny> = {
  actions?: readonly AutoFormAction<T>[];
  onSubmit?: (data: z.output<T>) => void;
  onCancel?: (data: z.input<T>) => void;
  submitLabel: string;
  cancelLabel: string;
};

export const normalizeAutoFormActions = <T extends z.ZodTypeAny>({
  actions,
  onSubmit,
  onCancel,
  submitLabel,
  cancelLabel
}: NormalizeAutoFormActionsOptions<T>): readonly AutoFormAction<T>[] => {
  const nextActions = [...(actions ?? [])];

  if (onCancel) {
    nextActions.push({
      type: 'cancel',
      label: cancelLabel,
      onCancel,
      variant: 'default'
    });
  }

  if (onSubmit) {
    nextActions.push({
      type: 'submit',
      label: submitLabel,
      onSubmit
    });
  }

  return nextActions;
};
