/**
 * Table定義やクエリ定義が不正なときに、定義時に投げるエラー。
 */
export class DefinitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DefinitionError";
  }
}

/**
 * 入力（キー、作成の入力、部分更新など）がSchemaを満たさないときのエラー。
 */
export class ValidationError extends Error {
  readonly issues: unknown;
  constructor(message: string, issues?: unknown) {
    super(message);
    this.name = "ValidationError";
    this.issues = issues;
  }
}

/**
 * 保存されている物理キーや属性が、定義と食い違うときのエラー。
 */
export class CorruptedDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CorruptedDataError";
  }
}
