import { en as app } from "./en/app";
import { en as arrayFields } from "./en/arrayFields";
import { en as basicInput } from "./en/basicInput";
import { en as booleanVariants } from "./en/booleanVariants";
import { en as computed } from "./en/computed";
import { en as computedVariants } from "./en/computedVariants";
import { en as customWidget } from "./en/customWidget";
import { en as date } from "./en/date";
import { en as discriminatedUnion } from "./en/discriminatedUnion";
import { en as discriminatedUnionAsTopLevel } from "./en/discriminatedUnionAsTopLevel";
import { en as dynamicAdvanced } from "./en/dynamicAdvanced";
import { en as dynamicSchema } from "./en/dynamicSchema";
import { en as e2eContainerRefine } from "./en/e2eContainerRefine";
import { en as e2eLazyLimit } from "./en/e2eLazyLimit";
import { en as e2eMisc } from "./en/e2eMisc";
import { en as e2eOpenRewrite } from "./en/e2eOpenRewrite";
import { en as e2eParsedSubmit } from "./en/e2eParsedSubmit";
import { en as e2ePassthrough } from "./en/e2ePassthrough";
import { en as e2eUnsupported } from "./en/e2eUnsupported";
import { en as enumSelect } from "./en/enumSelect";
import { en as externalKeyFilter } from "./en/externalKeyFilter";
import { en as file } from "./en/file";
import { en as fixedValues } from "./en/fixedValues";
import { en as formActions } from "./en/formActions";
import { en as formatterAndSuggestions } from "./en/formatterAndSuggestions";
import { en as i18nMessages } from "./en/i18nMessages";
import { en as intersection } from "./en/intersection";
import { en as literalUnionSelect } from "./en/literalUnionSelect";
import { en as mediaPreview } from "./en/mediaPreview";
import { en as nestedObject } from "./en/nestedObject";
import { en as nullableFields } from "./en/nullableFields";
import { en as objectLayout } from "./en/objectLayout";
import { en as reactiveBasicInput } from "./en/reactiveBasicInput";
import { en as reactiveEnumSelect } from "./en/reactiveEnumSelect";
import { en as reactiveNestedObject } from "./en/reactiveNestedObject";
import { en as reactiveReadOnly } from "./en/reactiveReadOnly";
import { en as reactiveRecord } from "./en/reactiveRecord";
import { en as readOnly } from "./en/readOnly";
import { en as recordEntries } from "./en/recordEntries";
import { en as recursiveSchema } from "./en/recursiveSchema";
import { en as refineValidation } from "./en/refineValidation";
import { en as schemaTransform } from "./en/schemaTransform";
import { en as selectAndExternalKey } from "./en/selectAndExternalKey";
import { en as shared } from "./en/shared";
import { en as tableView } from "./en/tableView";
import { en as time } from "./en/time";
import { en as union } from "./en/union";
import { en as unionArms } from "./en/unionArms";
import { en as validatePreceding } from "./en/validatePreceding";
import { en as zodBuiltins } from "./en/zodBuiltins";

/**
 * form-demo の英語の辞書（型の基準）。デモごとのファイル（`en/*.ts`）をまとめる。
 * 辞書を足したら、`ja.ts` にも同じ名前のファイルを足す
 */
export const en = {
  ...app,
  ...arrayFields,
  ...basicInput,
  ...booleanVariants,
  ...computed,
  ...computedVariants,
  ...customWidget,
  ...date,
  ...discriminatedUnion,
  ...discriminatedUnionAsTopLevel,
  ...dynamicAdvanced,
  ...dynamicSchema,
  ...e2eContainerRefine,
  ...e2eLazyLimit,
  ...e2eMisc,
  ...e2eOpenRewrite,
  ...e2eParsedSubmit,
  ...e2ePassthrough,
  ...e2eUnsupported,
  ...enumSelect,
  ...externalKeyFilter,
  ...file,
  ...fixedValues,
  ...formActions,
  ...formatterAndSuggestions,
  ...i18nMessages,
  ...intersection,
  ...literalUnionSelect,
  ...mediaPreview,
  ...nestedObject,
  ...nullableFields,
  ...objectLayout,
  ...reactiveBasicInput,
  ...reactiveEnumSelect,
  ...reactiveNestedObject,
  ...reactiveReadOnly,
  ...reactiveRecord,
  ...readOnly,
  ...recordEntries,
  ...recursiveSchema,
  ...refineValidation,
  ...schemaTransform,
  ...selectAndExternalKey,
  ...shared,
  ...tableView,
  ...time,
  ...union,
  ...unionArms,
  ...validatePreceding,
  ...zodBuiltins,
};
