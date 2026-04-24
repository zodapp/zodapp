import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { normalizeAutoFormActions, type AutoFormAction } from './autoFormActions';

describe('normalizeAutoFormActions', () => {
  const schema = z.object({
    name: z.string()
  });

  it('keeps explicit actions before legacy ones', () => {
    const explicitSubmit = vi.fn();
    const legacySubmit = vi.fn();
    const legacyCancel = vi.fn();

    const actions = normalizeAutoFormActions({
      actions: [
        {
          type: 'submit',
          label: '新しい下書きを保存',
          onSubmit: explicitSubmit
        } satisfies AutoFormAction<typeof schema>
      ],
      onSubmit: legacySubmit,
      onCancel: legacyCancel,
      submitLabel: '保存',
      cancelLabel: 'キャンセル'
    });

    expect(actions).toHaveLength(3);
    expect(actions[0]).toMatchObject({ type: 'submit', label: '新しい下書きを保存' });
    expect(actions[1]).toMatchObject({ type: 'button', label: 'キャンセル', variant: 'default' });
    expect(actions[2]).toMatchObject({ type: 'submit', label: '保存' });
  });

  it('returns only explicit actions when no legacy props exist', () => {
    const onClick = vi.fn();

    const actions = normalizeAutoFormActions({
      actions: [
        {
          type: 'button',
          label: '補助操作',
          onClick
        } satisfies AutoFormAction<typeof schema>
      ],
      submitLabel: '保存',
      cancelLabel: 'キャンセル'
    });

    expect(actions).toEqual([
      {
        type: 'button',
        label: '補助操作',
        onClick
      }
    ]);
  });

  it('keeps explicit reset actions unchanged', () => {
    const actions = normalizeAutoFormActions({
      actions: [
        {
          type: 'reset',
          label: '初期値に戻す'
        } satisfies AutoFormAction<typeof schema>
      ],
      submitLabel: '保存',
      cancelLabel: 'キャンセル'
    });

    expect(actions).toEqual([
      {
        type: 'reset',
        label: '初期値に戻す'
      }
    ]);
  });
});
