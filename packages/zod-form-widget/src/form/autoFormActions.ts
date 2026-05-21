import { Button, type ButtonProps } from '@mantine/core';
import { useStore, type AnyFormApi } from '@tanstack/react-form';
import { createElement, type ReactNode } from 'react';
import type { z } from 'zod';

export type AutoFormHandleSubmit<T extends z.ZodTypeAny> = () => Promise<
  z.output<T> | undefined
>;

export type AutoFormActionFormState = {
  isDirty: boolean;
  isPristine: boolean;
  isDefaultValue: boolean;
  isTouched: boolean;
  isValid: boolean;
  canSubmit: boolean;
  isSubmitting: boolean;
};

export type AutoFormActionComponentProps<T extends z.ZodTypeAny> = {
  form: AnyFormApi;
  handleSubmit: AutoFormHandleSubmit<T>;
  isLoading?: boolean;
};

export type AutoFormActionComponent<T extends z.ZodTypeAny> = (
  props: AutoFormActionComponentProps<T>,
) => ReactNode;

export type AutoFormActionResolverContext<T extends z.ZodTypeAny> =
  AutoFormActionComponentProps<T> & {
    formState: AutoFormActionFormState;
  };

export type AutoFormButtonActionContext<T extends z.ZodTypeAny> =
  AutoFormActionComponentProps<T> & {
    values: z.input<T>;
  };

export type AutoFormActionResolver<T extends z.ZodTypeAny, TResult> = (
  context: AutoFormActionResolverContext<T>,
) => TResult;

export type AutoFormActionResolverOrValue<T extends z.ZodTypeAny, TResult> =
  | TResult
  | AutoFormActionResolver<T, TResult>;

type AutoFormBaseActionHelperProps<T extends z.ZodTypeAny> = {
  label: string;
  variant?: ButtonProps['variant'];
  color?: ButtonProps['color'];
  hidden?: AutoFormActionResolverOrValue<T, boolean>;
  disabled?: AutoFormActionResolverOrValue<T, boolean>;
  loading?: AutoFormActionResolverOrValue<T, boolean>;
};

export type AutoFormSubmitActionHelperProps<T extends z.ZodTypeAny> =
  AutoFormBaseActionHelperProps<T> & {
    onSubmit: (data: z.output<T>) => void | Promise<void>;
  };

export type AutoFormButtonActionHelperProps<T extends z.ZodTypeAny> =
  AutoFormBaseActionHelperProps<T> & {
    onClick: (context: AutoFormButtonActionContext<T>) => void | Promise<void>;
  };

export type AutoFormResetActionHelperProps<T extends z.ZodTypeAny> =
  AutoFormBaseActionHelperProps<T> & {
    values?: z.input<T>;
    keepDefaultValues?: boolean;
  };

export type AutoFormCustomActionHelperProps<T extends z.ZodTypeAny> = {
  render: AutoFormActionComponent<T>;
};

export type AutoFormAction<T extends z.ZodTypeAny> =
  | ({ type: 'submit' } & AutoFormSubmitActionHelperProps<T>)
  | ({ type: 'button' } & AutoFormButtonActionHelperProps<T>)
  | ({ type: 'reset' } & AutoFormResetActionHelperProps<T>)
  | ({ type: 'custom' } & AutoFormCustomActionHelperProps<T>);

export type NormalizeAutoFormActionsOptions<T extends z.ZodTypeAny> = {
  actions?: readonly AutoFormAction<T>[];
  onSubmit?: (data: z.output<T>) => void;
  onCancel?: (data: z.input<T>) => void;
  submitLabel: string;
  cancelLabel: string;
};

export type NormalizeAutoFormActionComponentsOptions<T extends z.ZodTypeAny> =
  NormalizeAutoFormActionsOptions<T> & {
    actionComponents?: readonly AutoFormActionComponent<T>[];
  };

type MantineButtonComponent = (props: ButtonProps & {
  children?: ReactNode;
  onClick?: () => void | Promise<void>;
  type?: 'button';
  loading?: boolean;
  disabled?: boolean;
}) => ReactNode;

const MantineButton = Button as unknown as MantineButtonComponent;

const selectAutoFormActionFormState = (state: {
  isDirty: boolean;
  isPristine: boolean;
  isDefaultValue: boolean;
  isTouched: boolean;
  isValid: boolean;
  canSubmit: boolean;
  isSubmitting: boolean;
}): AutoFormActionFormState => ({
  isDirty: state.isDirty,
  isPristine: state.isPristine,
  isDefaultValue: state.isDefaultValue,
  isTouched: state.isTouched,
  isValid: state.isValid,
  canSubmit: state.canSubmit,
  isSubmitting: state.isSubmitting,
});

export const resolveAutoFormActionValue = <
  T extends z.ZodTypeAny,
  TResult,
>(
  value: AutoFormActionResolverOrValue<T, TResult>,
  context: AutoFormActionResolverContext<T>,
): TResult => {
  if (typeof value === 'function') {
    return (value as AutoFormActionResolver<T, TResult>)(context);
  }
  return value;
};

const createAutoFormButtonElement = <T extends z.ZodTypeAny>({
  action,
  resolverContext,
  onClick,
}: {
  action:
    | AutoFormSubmitActionHelperProps<T>
    | AutoFormButtonActionHelperProps<T>
    | AutoFormResetActionHelperProps<T>;
  resolverContext: AutoFormActionResolverContext<T>;
  onClick: () => void | Promise<void>;
}) => {
  const hidden =
    action.hidden === undefined
      ? false
      : resolveAutoFormActionValue(action.hidden, resolverContext);

  if (hidden) {
    return null;
  }

  const disabled =
    resolverContext.isLoading === true ||
    (action.disabled === undefined
      ? false
      : resolveAutoFormActionValue(action.disabled, resolverContext));

  const loading =
    action.loading === undefined
      ? false
      : resolveAutoFormActionValue(action.loading, resolverContext);

  return createElement(
    MantineButton,
    {
      variant: action.variant,
      color: action.color,
      onClick,
      type: 'button',
      loading,
      disabled,
    },
    action.label,
  );
};

export const createAutoFormSubmitAction = <T extends z.ZodTypeAny>(
  action: AutoFormSubmitActionHelperProps<T>,
): AutoFormActionComponent<T> => {
  const AutoFormSubmitActionComponent = ({
    form,
    handleSubmit,
    isLoading = false,
  }: AutoFormActionComponentProps<T>) => {
    const formState = useStore(form.store, selectAutoFormActionFormState);

    return createAutoFormButtonElement({
      action,
      resolverContext: { form, handleSubmit, isLoading, formState },
      onClick: async () => {
        const result = await handleSubmit();
        if (result !== undefined) {
          await action.onSubmit(result);
        }
      },
    });
  };

  AutoFormSubmitActionComponent.displayName = 'AutoFormSubmitActionComponent';

  return AutoFormSubmitActionComponent;
};

export const createAutoFormButtonAction = <T extends z.ZodTypeAny>(
  action: AutoFormButtonActionHelperProps<T>,
): AutoFormActionComponent<T> => {
  const AutoFormButtonActionComponent = ({
    form,
    handleSubmit,
    isLoading = false,
  }: AutoFormActionComponentProps<T>) => {
    const formState = useStore(form.store, selectAutoFormActionFormState);

    return createAutoFormButtonElement({
      action,
      resolverContext: { form, handleSubmit, isLoading, formState },
      onClick: async () => {
        await action.onClick({
          form,
          handleSubmit,
          isLoading,
          values: form.state.values as z.input<T>,
        });
      },
    });
  };

  AutoFormButtonActionComponent.displayName = 'AutoFormButtonActionComponent';

  return AutoFormButtonActionComponent;
};

export const createAutoFormResetAction = <T extends z.ZodTypeAny>(
  action: AutoFormResetActionHelperProps<T>,
): AutoFormActionComponent<T> => {
  const AutoFormResetActionComponent = ({
    form,
    handleSubmit,
    isLoading = false,
  }: AutoFormActionComponentProps<T>) => {
    const formState = useStore(form.store, selectAutoFormActionFormState);

    return createAutoFormButtonElement({
      action,
      resolverContext: { form, handleSubmit, isLoading, formState },
      onClick: () => {
        if (action.keepDefaultValues === undefined) {
          form.reset(action.values as never);
          return;
        }

        form.reset(action.values as never, {
          keepDefaultValues: action.keepDefaultValues,
        });
      },
    });
  };

  AutoFormResetActionComponent.displayName = 'AutoFormResetActionComponent';

  return AutoFormResetActionComponent;
};

export const createAutoFormActionComponent = <T extends z.ZodTypeAny>(
  action: AutoFormAction<T>,
): AutoFormActionComponent<T> => {
  switch (action.type) {
    case 'submit':
      return createAutoFormSubmitAction(action);
    case 'button':
      return createAutoFormButtonAction(action);
    case 'reset':
      return createAutoFormResetAction(action);
    case 'custom':
      return action.render;
  }
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
      type: 'button',
      label: cancelLabel,
      onClick: ({ values }) => onCancel(values),
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

export const normalizeAutoFormActionComponents = <T extends z.ZodTypeAny>({
  actionComponents,
  ...options
}: NormalizeAutoFormActionComponentsOptions<T>): readonly AutoFormActionComponent<T>[] => {
  return [
    ...(actionComponents ?? []),
    ...normalizeAutoFormActions(options).map((action) =>
      createAutoFormActionComponent(action),
    ),
  ];
};
