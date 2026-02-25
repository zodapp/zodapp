export type PathToken =
  | { t: "f" | "i" | "c"; n: number }
  | { t: "k"; s: string };

export type CellValue = string | number | boolean | Date | null;

export interface FieldEntry {
  fieldId: number;
  childNode: CompiledNode;
}

export interface ObjectNode {
  kind: "object";
  fields: Map<string, FieldEntry>;
}

export interface ArrayNode {
  kind: "array";
  elementNode: CompiledNode;
}

export interface RecordNode {
  kind: "record";
  valueNode: CompiledNode;
}

export interface UnionBranch {
  branchId: string;
  node: CompiledNode;
}

export interface UnionNode {
  kind: "union";
  controlId: number;
  branches: UnionBranch[];
}

export interface LeafNode {
  kind: "leaf";
  zodTypeName: string;
}

export type CompiledNode =
  | ObjectNode
  | ArrayNode
  | RecordNode
  | UnionNode
  | LeafNode;

export interface CompiledSchema {
  root: CompiledNode;
  fieldIdToName: Map<number, string>;
  controlIdMeta: Map<number, UnionMeta>;
}

export interface UnionMeta {
  controlId: number;
  branches: UnionBranch[];
}

export const MAX_ID = 0xffff;
export const CONTROL_HEADER = "__TYPE__";
