import type { FileResolverEntry, BaseFileConfigCore } from "./types";

/**
 * ローカル開発用のモックfileResolverEntry
 * 実際のアップロードは行わず、Data URLとして保持する
 *
 * @param type - ResolverのID（デフォルト: "mock"）
 */
export const createMockFileResolver = <TType extends string = "mock">({
  type = "mock" as TType,
}: { type?: TType } = {}): FileResolverEntry<TType, BaseFileConfigCore> => ({
  type,
  resolver: () => ({
    upload: async (file: File) => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          const url = `${dataUrl.split(",")[0]},${dataUrl.split(",")[1]}?mimeType=${encodeURIComponent(file.type)}`;
          resolve({ url });
        };
        reader.readAsDataURL(file);
      });
    },
    getDownloadUrl: async (storedUrl: string) => {
      const url = storedUrl.split("?")[0] ?? storedUrl;
      return { url };
    },
    delete: async () => {
      // モックなので何もしない
    },
  }),
});
