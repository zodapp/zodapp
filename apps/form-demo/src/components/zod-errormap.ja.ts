import { z } from "zod";
import { jaErrorMap } from "@zodapp/zod-form-widget/i18n/ja";

z.config({ customError: jaErrorMap });
