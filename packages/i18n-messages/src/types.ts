/**
 * 文言の辞書の型を集める interface。
 *
 * 各パッケージ・アプリが module augmentation で自分のキーを足す。
 * 辞書から型を作るときは {@link MessagesOf} を使う。
 *
 * @example
 * declare module "@zodapp/i18n-messages" {
 *   interface RegisteredMessages extends MessagesOf<typeof myAppEn> {}
 * }
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface RegisteredMessages {}

/** 登録されたキー */
export type MessageKey = keyof RegisteredMessages & string;

/**
 * 辞書の項目の値。文字列か、名前付きの params を受け取って文字列を返す関数。
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type MessageValue = string | ((params: any) => string);

/** 登録されたキーの一部を持つ辞書（Provider に渡す・上書きに使う） */
export type Messages = { [K in MessageKey]?: RegisteredMessages[K] };

/** キーと値の組を持つ、型を問わない辞書（実行時の引き当てに使う） */
export type MessageDictionary = Readonly<
  Record<string, MessageValue | undefined>
>;

/**
 * 辞書の値の型から {@link RegisteredMessages} に足す型を作る。
 * 型と辞書を二重に書かないために使う。
 */
export type MessagesOf<T> = { [K in keyof T]: T[K] };

/** キー K の params の型。文字列の項目なら never */
export type MessageParams<K extends MessageKey> =
  RegisteredMessages[K] extends (params: infer P) => string ? P : never;

/** msg(key, ...args) の args。関数の項目なら params が必須、文字列の項目なら無し */
export type MessageArgs<K extends MessageKey> =
  RegisteredMessages[K] extends (params: infer P) => string
    ? [params: P]
    : [];

/** msgKey に渡せる params の値。文字列に詰める */
export type MsgKeyParamValue = string | number | boolean | Date;

/** msgKey(key, ...args) の args。params の各値は {@link MsgKeyParamValue} で受け取る */
export type MsgKeyArgs<K extends MessageKey> =
  RegisteredMessages[K] extends (params: infer P) => string
    ? [params: { [P2 in keyof P]: MsgKeyParamValue }]
    : [];
