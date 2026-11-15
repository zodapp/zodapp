import { Button } from "@mantine/core";
import type { z } from "zod";
import type { AutoFormAction } from "@zodapp/zod-form-widget/form";

/**
 * 横幅いっぱいの送信ボタンを、AutoForm の custom のアクションとして作る。
 * ログインのように、入力欄の下にボタン 1 つを置く画面で使う。
 * type="submit" なので、入力欄で Enter を押してもこのボタンが押される。
 */
export const fullWidthSubmitAction = <T extends z.ZodTypeAny>(
  label: string,
  onSubmit: (data: z.output<T>) => void | Promise<void>,
): AutoFormAction<T> => ({
  type: "custom",
  render: ({ handleSubmit, isLoading }) => (
    <Button
      type="submit"
      fullWidth
      loading={isLoading}
      onClick={async () => {
        const data = await handleSubmit();
        if (data !== undefined) {
          await onSubmit(data);
        }
      }}
    >
      {label}
    </Button>
  ),
});
