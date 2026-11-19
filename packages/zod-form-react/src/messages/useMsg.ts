import "./types";
import { createUseMsg } from "@zodapp/i18n-messages-react";
import { en as zodEn } from "@zodapp/i18n-messages-zod/messages";
import { en } from "./en";

/** zod-form-react の部品が使う useMsg（Provider の外では英語） */
export const useMsg = createUseMsg(zodEn, en);
