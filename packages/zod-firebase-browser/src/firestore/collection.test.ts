import firebase from "firebase/compat/app";
import "firebase/compat/firestore";
import { describe, expect, it } from "vitest";

import { convertForFirestoreWrite } from "./collection";

const isDeleteSentinel = (value: unknown): value is firebase.firestore.FieldValue => {
  return (
    typeof value === "object" &&
    value !== null &&
    "isEqual" in value &&
    typeof (value as { isEqual?: unknown }).isEqual === "function" &&
    (value as firebase.firestore.FieldValue).isEqual(firebase.firestore.FieldValue.delete())
  );
};

describe("convertForFirestoreWrite", () => {
  it("keeps merge delete semantics for plain objects outside arrays", () => {
    const normalized = convertForFirestoreWrite(
      {
        currentVersionId: undefined,
        currentData: {
          config: {
            responseSchema: {
              description: undefined,
            },
          },
        },
      },
      "merge",
    ) as {
      currentVersionId: unknown;
      currentData: {
        config: {
          responseSchema: {
            description: unknown;
          };
        };
      };
    };

    expect(isDeleteSentinel(normalized.currentVersionId)).toBe(true);
    expect(isDeleteSentinel(normalized.currentData.config.responseSchema.description)).toBe(true);
  });

  it("drops undefined fields inside objects nested under arrays during merge", () => {
    const normalized = convertForFirestoreWrite(
      {
        currentData: {
          type: "simpleBot",
          isDraft: false,
          config: {
            systemPrompt: "prompt",
            initialText: "hello",
            responseSchema: {
              type: "object",
              properties: [
                {
                  key: "customer",
                  isRequired: undefined,
                  schema: {
                    type: "object",
                    properties: [
                      {
                        key: "name",
                        isRequired: undefined,
                        schema: {
                          type: "string",
                          enum: undefined,
                        },
                      },
                    ],
                  },
                },
                undefined,
              ],
            },
          },
        },
        lastVersionId: undefined,
      },
      "merge",
    ) as {
      currentData: {
        config: {
          responseSchema: {
            properties: Array<{
              key: string;
              isRequired?: boolean;
              schema: {
                type: string;
                properties?: Array<{
                  key: string;
                  isRequired?: boolean;
                  schema: {
                    type: string;
                    enum?: string[];
                  };
                }>;
              };
            } | null>;
          };
        };
      };
      lastVersionId: unknown;
    };

    expect(isDeleteSentinel(normalized.lastVersionId)).toBe(true);
    expect(normalized.currentData.config.responseSchema.properties[1]).toBeNull();

    const property = normalized.currentData.config.responseSchema.properties[0];
    expect(property).not.toBeNull();
    expect(property).not.toHaveProperty("isRequired");

    const nestedProperty = property?.schema.properties?.[0];
    expect(nestedProperty).toBeDefined();
    expect(nestedProperty).not.toHaveProperty("isRequired");
    expect(nestedProperty?.schema).not.toHaveProperty("enum");
  });
});
