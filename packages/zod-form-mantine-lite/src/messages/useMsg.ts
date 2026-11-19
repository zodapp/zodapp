import "./types";
import { createUseMsg } from "@zodapp/i18n-messages-react";
import { en as reactEn } from "@zodapp/zod-form-react/messages";
import { en } from "./en";

/** zod-form-mantine-lite の部品が使う useMsg（Provider の外では英語） */
export const useMsg = createUseMsg(reactEn, en);
