export const ErrorCode = {
  E_UNION_TYPE_COLLISION:
    "E_UNION_TYPE_COLLISION" as const,
  E_ID_OVERFLOW:
    "E_ID_OVERFLOW" as const,
  E_INVALID_CONTROL_VALUE:
    "E_INVALID_CONTROL_VALUE" as const,
  E_UNSUPPORTED_SCHEMA:
    "E_UNSUPPORTED_SCHEMA" as const,
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];
