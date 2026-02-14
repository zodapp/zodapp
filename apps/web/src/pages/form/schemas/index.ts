import * as basicInput from "./basicInput";
import * as computed from "./computed";
import * as date from "./date";
import * as enumSelect from "./enumSelect";
import * as union from "./union";
import * as discriminatedUnion from "./discriminatedUnion";
import * as arrayFields from "./arrayFields";
import * as nestedObject from "./nestedObject";
import * as refineValidation from "./refineValidation";
import * as recursiveData from "./recursiveSchema";
import * as file from "./file";
import * as readOnly from "./readOnly";

import basicInputCode from "./basicInput.ts?raw";
import computedCode from "./computed.ts?raw";
import dateCode from "./date.ts?raw";
import enumSelectCode from "./enumSelect.ts?raw";
import unionCode from "./union.ts?raw";
import discriminatedUnionCode from "./discriminatedUnion.ts?raw";
import arrayFieldsCode from "./arrayFields.ts?raw";
import nestedObjectCode from "./nestedObject.ts?raw";
import refineValidationCode from "./refineValidation.ts?raw";
import recursiveDataCode from "./recursiveSchema.ts?raw";
import fileCode from "./file.ts?raw";
import readOnlyCode from "./readOnly.ts?raw";

export const formSchemas = {
  [basicInput.formId]: basicInput,
  [date.formId]: date,
  [enumSelect.formId]: enumSelect,
  [arrayFields.formId]: arrayFields,
  [readOnly.formId]: readOnly,
  [discriminatedUnion.formId]: discriminatedUnion,
  [computed.formId]: computed,
  [union.formId]: union,
  [nestedObject.formId]: nestedObject,
  [refineValidation.formId]: refineValidation,
  [recursiveData.formId]: recursiveData,
  [file.formId]: file,
} as const;

export const formCodes = {
  [basicInput.formId]: basicInputCode,
  [date.formId]: dateCode,
  [enumSelect.formId]: enumSelectCode,
  [arrayFields.formId]: arrayFieldsCode,
  [readOnly.formId]: readOnlyCode,
  [union.formId]: unionCode,
  [discriminatedUnion.formId]: discriminatedUnionCode,
  [nestedObject.formId]: nestedObjectCode,
  [refineValidation.formId]: refineValidationCode,
  [recursiveData.formId]: recursiveDataCode,
  [computed.formId]: computedCode,
  [file.formId]: fileCode,
} as const;

export type FormId = keyof typeof formSchemas;
export const formIds = Object.keys(formSchemas) as FormId[];

export const defaultFormId: FormId = "basicInput";
