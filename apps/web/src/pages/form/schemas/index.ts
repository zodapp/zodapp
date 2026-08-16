import * as basicInput from "./basicInput";
import * as formatterAndSuggestions from "./formatterAndSuggestions";
import * as booleanVariants from "./booleanVariants";
import * as objectLayout from "./objectLayout";
import * as recordEntries from "./recordEntries";
import * as computed from "./computed";
import * as date from "./date";
import * as enumSelect from "./enumSelect";
import * as union from "./union";
import * as discriminatedUnion from "./discriminatedUnion";
import * as discriminatedUnionAsTopLevel from "./discriminatedUnionAsTopLevel";
import * as arrayFields from "./arrayFields";
import * as nestedObject from "./nestedObject";
import * as refineValidation from "./refineValidation";
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
import computedCode from "./computed.ts?raw";
import dateCode from "./date.ts?raw";
import enumSelectCode from "./enumSelect.ts?raw";
import unionCode from "./union.ts?raw";
import discriminatedUnionCode from "./discriminatedUnion.ts?raw";
import discriminatedUnionAsTopLevelCode from "./discriminatedUnionAsTopLevel.ts?raw";
import arrayFieldsCode from "./arrayFields.ts?raw";
import nestedObjectCode from "./nestedObject.ts?raw";
import refineValidationCode from "./refineValidation.ts?raw";
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
  [objectLayout.formId]: objectLayout,
  [recordEntries.formId]: recordEntries,
  [date.formId]: date,
  [enumSelect.formId]: enumSelect,
  [arrayFields.formId]: arrayFields,
  [readOnly.formId]: readOnly,
  [discriminatedUnion.formId]: discriminatedUnion,
  [discriminatedUnionAsTopLevel.formId]: discriminatedUnionAsTopLevel,
  [computed.formId]: computed,
  [union.formId]: union,
  [nestedObject.formId]: nestedObject,
  [refineValidation.formId]: refineValidation,
  [recursiveData.formId]: recursiveData,
  [file.formId]: file,
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
  [objectLayout.formId]: objectLayoutCode,
  [recordEntries.formId]: recordEntriesCode,
  [date.formId]: dateCode,
  [enumSelect.formId]: enumSelectCode,
  [arrayFields.formId]: arrayFieldsCode,
  [readOnly.formId]: readOnlyCode,
  [union.formId]: unionCode,
  [discriminatedUnion.formId]: discriminatedUnionCode,
  [discriminatedUnionAsTopLevel.formId]: discriminatedUnionAsTopLevelCode,
  [nestedObject.formId]: nestedObjectCode,
  [refineValidation.formId]: refineValidationCode,
  [recursiveData.formId]: recursiveDataCode,
  [computed.formId]: computedCode,
  [file.formId]: fileCode,
  [reactiveBasicInput.formId]: reactiveBasicInputCode,
  [reactiveEnumSelect.formId]: reactiveEnumSelectCode,
  [reactiveNestedObject.formId]: reactiveNestedObjectCode,
  [reactiveReadOnly.formId]: reactiveReadOnlyCode,
  [reactiveRecord.formId]: reactiveRecordCode,
} as const;

export type FormId = keyof typeof formSchemas;
export const formIds = Object.keys(formSchemas) as FormId[];

export const defaultFormId: FormId = "basicInput";
