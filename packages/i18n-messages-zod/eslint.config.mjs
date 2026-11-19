import { config } from "@repo/eslint-config/base";
import { i18nMessagesConfig } from "@repo/eslint-config/i18n-messages";

/** @type {import("eslint").Linter.Config[]} */
export default [...config, ...i18nMessagesConfig()];
