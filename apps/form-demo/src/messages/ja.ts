import type { MessagesOf } from "@zodapp/i18n-messages";
import type { en } from "./en";
import { ja as app } from "./ja/app";
import { ja as arrayFields } from "./ja/arrayFields";
import { ja as basicInput } from "./ja/basicInput";
import { ja as booleanVariants } from "./ja/booleanVariants";
import { ja as computed } from "./ja/computed";
import { ja as computedVariants } from "./ja/computedVariants";
import { ja as customWidget } from "./ja/customWidget";
import { ja as date } from "./ja/date";
import { ja as discriminatedUnion } from "./ja/discriminatedUnion";
import { ja as discriminatedUnionAsTopLevel } from "./ja/discriminatedUnionAsTopLevel";
import { ja as dynamicAdvanced } from "./ja/dynamicAdvanced";
import { ja as dynamicSchema } from "./ja/dynamicSchema";
import { ja as e2eContainerRefine } from "./ja/e2eContainerRefine";
import { ja as e2eLazyLimit } from "./ja/e2eLazyLimit";
import { ja as e2eMisc } from "./ja/e2eMisc";
import { ja as e2eOpenRewrite } from "./ja/e2eOpenRewrite";
import { ja as e2eParsedSubmit } from "./ja/e2eParsedSubmit";
import { ja as e2ePassthrough } from "./ja/e2ePassthrough";
import { ja as e2eUnsupported } from "./ja/e2eUnsupported";
import { ja as enumSelect } from "./ja/enumSelect";
import { ja as externalKeyFilter } from "./ja/externalKeyFilter";
import { ja as file } from "./ja/file";
import { ja as fixedValues } from "./ja/fixedValues";
import { ja as formActions } from "./ja/formActions";
import { ja as formatterAndSuggestions } from "./ja/formatterAndSuggestions";
import { ja as i18nMessages } from "./ja/i18nMessages";
import { ja as intersection } from "./ja/intersection";
import { ja as literalUnionSelect } from "./ja/literalUnionSelect";
import { ja as mediaPreview } from "./ja/mediaPreview";
import { ja as nestedObject } from "./ja/nestedObject";
import { ja as nullableFields } from "./ja/nullableFields";
import { ja as objectLayout } from "./ja/objectLayout";
import { ja as reactiveBasicInput } from "./ja/reactiveBasicInput";
import { ja as reactiveEnumSelect } from "./ja/reactiveEnumSelect";
import { ja as reactiveNestedObject } from "./ja/reactiveNestedObject";
import { ja as reactiveReadOnly } from "./ja/reactiveReadOnly";
import { ja as reactiveRecord } from "./ja/reactiveRecord";
import { ja as readOnly } from "./ja/readOnly";
import { ja as recordEntries } from "./ja/recordEntries";
import { ja as recursiveSchema } from "./ja/recursiveSchema";
import { ja as refineValidation } from "./ja/refineValidation";
import { ja as schemaTransform } from "./ja/schemaTransform";
import { ja as selectAndExternalKey } from "./ja/selectAndExternalKey";
import { ja as shared } from "./ja/shared";
import { ja as tableView } from "./ja/tableView";
import { ja as time } from "./ja/time";
import { ja as union } from "./ja/union";
import { ja as unionArms } from "./ja/unionArms";
import { ja as validatePreceding } from "./ja/validatePreceding";
import { ja as zodBuiltins } from "./ja/zodBuiltins";

/** form-demo の日本語の辞書。デモごとのファイル（`ja/*.ts`）をまとめる */
export const ja = {
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
} satisfies MessagesOf<typeof en>;
