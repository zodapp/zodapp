import { DefinitionError } from "./errors";

/** GSIのスロットの射影（§5.5） */
export type SlotProjection =
  "ALL" | "KEYS_ONLY" | { readonly include: readonly string[] };

export type IndexSlot = {
  readonly pk: string;
  readonly sk: string;
  readonly projection: SlotProjection;
};

export type VectorDistance = "COSINE" | "DOT_PRODUCT" | "EUCLIDEAN";

export type VectorSlot = {
  /** embeddingベクトルを書く属性名 */
  readonly vector: string;
  /** `HASH` の属性名 */
  readonly hash: string;
  /** `INLINE_FILTER` の属性名（最大18） */
  readonly filters: readonly string[];
  readonly dimensions: number;
  readonly distance: VectorDistance;
  readonly projection: SlotProjection;
};

/** ライブラリ管理属性。予約名（§5.5） */
export const VERSION_ATTRIBUTE = "_version";

export type PhysicalTable<
  TIndexes extends Record<string, IndexSlot> = Record<string, IndexSlot>,
  TVectors extends Record<string, VectorSlot> = Record<string, VectorSlot>,
> = {
  readonly name: string;
  readonly primary: { readonly pk: string; readonly sk: string };
  readonly indexes: TIndexes;
  readonly vectorIndexes: TVectors;
  /** 物理キーとライブラリ管理属性の名前。itemのフィールド名に使えない */
  readonly reservedAttributes: ReadonlySet<string>;
};

const MAX_INLINE_FILTERS = 18;
const MAX_VECTOR_DIMENSIONS = 4096;

/**
 * 物理レイアウトを定義する。アプリケーションで一度だけ定義し、各Table定義から参照する（§5.5）。
 */
export const physicalTable = <
  const TIndexes extends Record<string, IndexSlot> = Record<never, IndexSlot>,
  const TVectors extends Record<string, VectorSlot> = Record<never, VectorSlot>,
>(input: {
  readonly name: string;
  readonly primary: { readonly pk: string; readonly sk: string };
  readonly indexes?: TIndexes;
  readonly vectorIndexes?: TVectors;
}): PhysicalTable<TIndexes, TVectors> => {
  const indexes = (input.indexes ?? {}) as TIndexes;
  const vectorIndexes = (input.vectorIndexes ?? {}) as TVectors;
  const reserved = new Set<string>([VERSION_ATTRIBUTE]);
  const claim = (attribute: string, owner: string) => {
    if (reserved.has(attribute)) {
      throw new DefinitionError(
        `physical table "${input.name}": attribute "${attribute}" (${owner}) is used twice or reserved`,
      );
    }
    reserved.add(attribute);
  };
  claim(input.primary.pk, "primary.pk");
  claim(input.primary.sk, "primary.sk");
  for (const [slot, def] of Object.entries(indexes)) {
    claim(def.pk, `indexes.${slot}.pk`);
    claim(def.sk, `indexes.${slot}.sk`);
  }
  for (const [slot, def] of Object.entries(vectorIndexes)) {
    if (def.filters.length > MAX_INLINE_FILTERS) {
      throw new DefinitionError(
        `vector slot "${slot}": at most ${MAX_INLINE_FILTERS} inline filters are allowed`,
      );
    }
    if (
      !Number.isInteger(def.dimensions) ||
      def.dimensions < 1 ||
      def.dimensions > MAX_VECTOR_DIMENSIONS
    ) {
      throw new DefinitionError(
        `vector slot "${slot}": dimensions must be an integer between 1 and ${MAX_VECTOR_DIMENSIONS}`,
      );
    }
    claim(def.vector, `vectorIndexes.${slot}.vector`);
    claim(def.hash, `vectorIndexes.${slot}.hash`);
    def.filters.forEach((f, i) =>
      claim(f, `vectorIndexes.${slot}.filters[${i}]`),
    );
  }
  return {
    name: input.name,
    primary: input.primary,
    indexes,
    vectorIndexes,
    reservedAttributes: reserved,
  };
};
