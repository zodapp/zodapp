import "./types";
import { createUseMsg } from "@zodapp/i18n-messages-react";
import { en as liteEn } from "@zodapp/zod-form-mantine-lite/messages";
import { en } from "./en";

/** zod-form-mantine の部品が使う useMsg（Provider の外では英語）。lite の辞書は react・zod の辞書も含む */
export const useMsg = createUseMsg(liteEn, en);
