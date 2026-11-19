import * as basicInput from "./basicInput";
import * as formatterAndSuggestions from "./formatterAndSuggestions";
import * as booleanVariants from "./booleanVariants";
import * as objectLayout from "./objectLayout";
import * as recordEntries from "./recordEntries";
import * as computedVariants from "./computedVariants";
import * as schemaTransform from "./schemaTransform";
import * as validatePreceding from "./validatePreceding";
import * as formActions from "./formActions";
import * as dynamicSchema from "./dynamicSchema";
import * as tableView from "./tableView";
import * as dynamicAdvanced from "./dynamicAdvanced";
import * as selectAndExternalKey from "./selectAndExternalKey";
import * as externalKeyFilter from "./externalKeyFilter";
import * as mediaPreview from "./mediaPreview";
import * as customWidget from "./customWidget";
import * as computed from "./computed";
import * as date from "./date";
import * as time from "./time";
import * as enumSelect from "./enumSelect";
import * as union from "./union";
import * as unionArms from "./unionArms";
import * as discriminatedUnion from "./discriminatedUnion";
import * as discriminatedUnionAsTopLevel from "./discriminatedUnionAsTopLevel";
import * as arrayFields from "./arrayFields";
import * as nestedObject from "./nestedObject";
import * as nullableFields from "./nullableFields";
import * as literalUnionSelect from "./literalUnionSelect";
import * as intersection from "./intersection";
import * as refineValidation from "./refineValidation";
import * as i18nMessages from "./i18nMessages";
import * as recursiveData from "./recursiveSchema";
import * as file from "./file";
import * as readOnly from "./readOnly";
import * as reactiveBasicInput from "./reactiveBasicInput";
import * as reactiveEnumSelect from "./reactiveEnumSelect";
import * as reactiveNestedObject from "./reactiveNestedObject";
import * as reactiveReadOnly from "./reactiveReadOnly";
import * as reactiveRecord from "./reactiveRecord";

import basicInputCode from "./basicInput.ts?raw";
import formatterAndSuggestionsCode from "./formatterAndSuggestions.ts?raw";
import booleanVariantsCode from "./booleanVariants.ts?raw";
import objectLayoutCode from "./objectLayout.ts?raw";
import recordEntriesCode from "./recordEntries.ts?raw";
import computedVariantsCode from "./computedVariants.ts?raw";
import schemaTransformCode from "./schemaTransform.tsx?raw";
import validatePrecedingCode from "./validatePreceding.ts?raw";
import formActionsCode from "./formActions.tsx?raw";
import dynamicSchemaCode from "./dynamicSchema.ts?raw";
import tableViewCode from "./tableView.tsx?raw";
import dynamicAdvancedCode from "./dynamicAdvanced.tsx?raw";
import selectAndExternalKeyCode from "./selectAndExternalKey.tsx?raw";
import externalKeyFilterCode from "./externalKeyFilter.tsx?raw";
import mediaPreviewCode from "./mediaPreview.tsx?raw";
import customWidgetCode from "./customWidget.tsx?raw";
import computedCode from "./computed.ts?raw";
import dateCode from "./date.ts?raw";
import timeCode from "./time.ts?raw";
import enumSelectCode from "./enumSelect.ts?raw";
import unionCode from "./union.ts?raw";
import unionArmsCode from "./unionArms.tsx?raw";
import discriminatedUnionCode from "./discriminatedUnion.tsx?raw";
import discriminatedUnionAsTopLevelCode from "./discriminatedUnionAsTopLevel.ts?raw";
import arrayFieldsCode from "./arrayFields.ts?raw";
import nestedObjectCode from "./nestedObject.ts?raw";
import nullableFieldsCode from "./nullableFields.ts?raw";
import literalUnionSelectCode from "./literalUnionSelect.ts?raw";
import intersectionCode from "./intersection.ts?raw";
import refineValidationCode from "./refineValidation.ts?raw";
import i18nMessagesCode from "./i18nMessages.ts?raw";
import recursiveDataCode from "./recursiveSchema.ts?raw";
import fileCode from "./file.ts?raw";
import readOnlyCode from "./readOnly.ts?raw";
import reactiveBasicInputCode from "./reactiveBasicInput.ts?raw";
import reactiveEnumSelectCode from "./reactiveEnumSelect.ts?raw";
import reactiveNestedObjectCode from "./reactiveNestedObject.ts?raw";
import reactiveReadOnlyCode from "./reactiveReadOnly.ts?raw";
import reactiveRecordCode from "./reactiveRecord.ts?raw";

export const formSchemas = {
  [basicInput.formId]: basicInput,
  [formatterAndSuggestions.formId]: formatterAndSuggestions,
  [booleanVariants.formId]: booleanVariants,
  [date.formId]: date,
  [time.formId]: time,
  [enumSelect.formId]: enumSelect,
  [arrayFields.formId]: arrayFields,
  [nestedObject.formId]: nestedObject,
  [nullableFields.formId]: nullableFields,
  [literalUnionSelect.formId]: literalUnionSelect,
  [intersection.formId]: intersection,
  [objectLayout.formId]: objectLayout,
  [recordEntries.formId]: recordEntries,
  [union.formId]: union,
  [unionArms.formId]: unionArms,
  [discriminatedUnion.formId]: discriminatedUnion,
  [discriminatedUnionAsTopLevel.formId]: discriminatedUnionAsTopLevel,
  [recursiveData.formId]: recursiveData,
  [refineValidation.formId]: refineValidation,
  [i18nMessages.formId]: i18nMessages,
  [file.formId]: file,
  [mediaPreview.formId]: mediaPreview,
  [computed.formId]: computed,
  [computedVariants.formId]: computedVariants,
  [dynamicSchema.formId]: dynamicSchema,
  [dynamicAdvanced.formId]: dynamicAdvanced,
  [selectAndExternalKey.formId]: selectAndExternalKey,
  [externalKeyFilter.formId]: externalKeyFilter,
  [readOnly.formId]: readOnly,
  [schemaTransform.formId]: schemaTransform,
  [validatePreceding.formId]: validatePreceding,
  [formActions.formId]: formActions,
  [customWidget.formId]: customWidget,
  [tableView.formId]: tableView,
  [reactiveBasicInput.formId]: reactiveBasicInput,
  [reactiveEnumSelect.formId]: reactiveEnumSelect,
  [reactiveNestedObject.formId]: reactiveNestedObject,
  [reactiveReadOnly.formId]: reactiveReadOnly,
  [reactiveRecord.formId]: reactiveRecord,
} as const;

export const formCodes = {
  [basicInput.formId]: basicInputCode,
  [formatterAndSuggestions.formId]: formatterAndSuggestionsCode,
  [booleanVariants.formId]: booleanVariantsCode,
  [date.formId]: dateCode,
  [time.formId]: timeCode,
  [enumSelect.formId]: enumSelectCode,
  [arrayFields.formId]: arrayFieldsCode,
  [nestedObject.formId]: nestedObjectCode,
  [nullableFields.formId]: nullableFieldsCode,
  [literalUnionSelect.formId]: literalUnionSelectCode,
  [intersection.formId]: intersectionCode,
  [objectLayout.formId]: objectLayoutCode,
  [recordEntries.formId]: recordEntriesCode,
  [union.formId]: unionCode,
  [unionArms.formId]: unionArmsCode,
  [discriminatedUnion.formId]: discriminatedUnionCode,
  [discriminatedUnionAsTopLevel.formId]: discriminatedUnionAsTopLevelCode,
  [recursiveData.formId]: recursiveDataCode,
  [refineValidation.formId]: refineValidationCode,
  [i18nMessages.formId]: i18nMessagesCode,
  [file.formId]: fileCode,
  [mediaPreview.formId]: mediaPreviewCode,
  [computed.formId]: computedCode,
  [computedVariants.formId]: computedVariantsCode,
  [dynamicSchema.formId]: dynamicSchemaCode,
  [dynamicAdvanced.formId]: dynamicAdvancedCode,
  [selectAndExternalKey.formId]: selectAndExternalKeyCode,
  [externalKeyFilter.formId]: externalKeyFilterCode,
  [readOnly.formId]: readOnlyCode,
  [schemaTransform.formId]: schemaTransformCode,
  [validatePreceding.formId]: validatePrecedingCode,
  [formActions.formId]: formActionsCode,
  [customWidget.formId]: customWidgetCode,
  [tableView.formId]: tableViewCode,
  [reactiveBasicInput.formId]: reactiveBasicInputCode,
  [reactiveEnumSelect.formId]: reactiveEnumSelectCode,
  [reactiveNestedObject.formId]: reactiveNestedObjectCode,
  [reactiveReadOnly.formId]: reactiveReadOnlyCode,
  [reactiveRecord.formId]: reactiveRecordCode,
} as const;

export type FormId = keyof typeof formSchemas;
export const formIds = Object.keys(formSchemas) as FormId[];

export const defaultFormId: FormId = "basicInput";
