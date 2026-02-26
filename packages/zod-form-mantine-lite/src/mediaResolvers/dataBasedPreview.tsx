/**
 * DataBasedPreview
 * データ型mediaResolver用の中間コンポーネント
 * URLからデータを取得してコンポーネントに渡す
 */

import { useState, useEffect } from "react";
import { Loader } from "@mantine/core";
import type { DataPreviewProps } from "@zodapp/zod-form-react/media";

type DataBasedPreviewProps = {
  url: string;
  mimeType: string;
  component: React.ComponentType<DataPreviewProps>;
};

/**
 * URL からバイナリデータを取得して、データ型プレビューコンポーネントへ渡します。
 *
 * data resolver の共通処理（fetch → ArrayBuffer）をまとめた中間コンポーネントです。
 */
export function DataBasedPreview({
  url,
  mimeType,
  component: Component,
}: DataBasedPreviewProps) {
  const [data, setData] = useState<ArrayBuffer | null>(null);

  useEffect(() => {
    fetch(url)
      .then((res) => res.arrayBuffer())
      .then(setData);
  }, [url]);

  if (!data) return <Loader size="sm" />;

  return <Component data={data} mimeType={mimeType} />;
}
