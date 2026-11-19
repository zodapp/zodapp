import "./types";
import { createUseMsg } from "@zodapp/i18n-messages-react";
import { en as mantineEn } from "@zodapp/zod-form-mantine/messages";
import { en } from "./en";

/** zod-form-widget の部品が使う useMsg（Provider の外では英語）。mantine の辞書は依存するパッケージの辞書も含む */
export const useMsg = createUseMsg(mantineEn, en);
