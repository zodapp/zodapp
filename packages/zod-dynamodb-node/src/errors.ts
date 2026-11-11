/**
 * 書き込みが行われなかった（Itemが存在しないか、条件が成り立たない）。
 * Repositoryは2つを区別して返すが、クライアントに返すときは区別しない（§6.4 `where` 条件）。
 * Itemの存在を、認可されていないクライアントに教えないためである。
 */
export abstract class WriteNotAppliedError extends Error {
  /** クライアントに返すメッセージ。両方の可能性を示す */
  static readonly publicMessage =
    "the item does not exist or the write condition was not satisfied";
  /** クライアントに返すメッセージ */
  readonly publicMessage = WriteNotAppliedError.publicMessage;
}

/** 更新や削除の対象のItemが存在しない */
export class ItemNotFoundError extends WriteNotAppliedError {
  constructor(entity: string) {
    super(`${entity}: item not found`);
    this.name = "ItemNotFoundError";
  }
}

/** 作成しようとしたItemがすでに存在する */
export class ItemAlreadyExistsError extends Error {
  constructor(entity: string) {
    super(`${entity}: item already exists`);
    this.name = "ItemAlreadyExistsError";
  }
}

/** 書き込みの条件（`where` / `check`）が成り立たない */
export class ConditionFailedError extends WriteNotAppliedError {
  constructor(entity: string) {
    super(`${entity}: write condition was not satisfied`);
    this.name = "ConditionFailedError";
  }
}

/** 読み取った後に他の更新が入り、再試行の上限に達した */
export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

/** ページネーショントークンが不正、または別のクエリのもの */
export class InvalidCursorError extends Error {
  constructor(message = "invalid cursor") {
    super(message);
    this.name = "InvalidCursorError";
  }
}

/** `ifUnchanged` のトークンを取得した後に、ほかの更新が入った（§6.4） */
export class StaleItemError extends Error {
  constructor(entity: string) {
    super(`${entity}: the item was updated by someone else after it was read`);
    this.name = "StaleItemError";
  }
}

/** `ifUnchanged` のトークンが不正、または別のItemのもの */
export class InvalidTokenError extends Error {
  constructor(message = "invalid token") {
    super(message);
    this.name = "InvalidTokenError";
  }
}

/** トランザクションやbatchの制約に反する操作 */
export class TransactionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransactionError";
  }
}

/** 認可（`authorize`）で拒否された */
export class ForbiddenError extends Error {
  constructor(message = "forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/**
 * 認証の情報がない、正しくない、または期限が切れている（`UNAUTHENTICATED`）。
 * `createServerApi` の `context` や `checkContext` から投げる
 */
export class UnauthenticatedError extends Error {
  constructor(message = "unauthenticated", options?: { cause?: unknown }) {
    super(message, options);
    this.name = "UnauthenticatedError";
  }
}

/** `authorize` を持つ操作を、認証コンテキストなしで呼んだ */
export class MissingContextError extends Error {
  constructor(operation: string) {
    super(
      `operation "${operation}" needs an auth context: pass { context } or run it inside a scope`,
    );
    this.name = "MissingContextError";
  }
}
