import { z } from "zod";

const jaErrorMap: z.core.$ZodErrorMap = (issue) => {
  let message: string;
  switch (issue.code) {
    case "invalid_type":
      if (issue.input === undefined || issue.input === null) {
        message = "必ず入力してください。";
      } else {
        message = `無効な値です。修正してください。`;
      }
      break;
    case "invalid_value":
      if (issue.input === undefined || issue.input === null) {
        message = "必ず入力してください。";
      } else {
        message = `無効な値です。修正してください。`;
      }
      break;
    case "unrecognized_keys":
      message = `オブジェクトのキー '${issue.keys.join(
        ", ",
      )}' が識別できません。`;
      break;
    case "invalid_union":
      console.log("invalid_union", issue);
      message = "";
      break;
    case "invalid_format":
      if (issue.format === "starts_with") {
        message = `"${issue.prefix}"で始まる文字列を入力してください。`;
      } else if (issue.format === "ends_with") {
        message = `"${issue.suffix}"で終わる文字列を入力してください。`;
      } else if (issue.format === "includes") {
        message = `"${issue.includes}"を含む文字列を入力してください。`;
      } else if (issue.format === "regex") {
        message = `パターン${issue.pattern}に一致する必要があります。`;
      } else if (issue.format === "email") {
        message = "有効なメールアドレスを入力してください。";
      } else if (issue.format === "url") {
        message = "有効なURLを入力してください。";
      } else if (issue.format === "uuid") {
        message = "有効なUUIDを入力してください。";
      } else if (issue.format === "datetime") {
        message = "有効なISO日時を入力してください。";
      } else if (issue.format === "date") {
        message = "有効なISO日付を入力してください。";
      } else {
        message = `${issue.format} の形式で入力してください。`;
      }
      break;
    case "too_small":
      if (issue.origin === "array") {
        if (issue.inclusive)
          message = `${issue.minimum}個以上の要素を設定する必要があります。`;
        else
          message = `${issue.minimum}個より多くの要素を設定する必要があります。`;
      } else if (issue.origin === "string") {
        if (issue.inclusive)
          message = `${issue.minimum}文字以上で入力してください。`;
        else message = `${issue.minimum}文字より多く入力してください。`;
      } else if (issue.origin === "number") {
        if (issue.inclusive)
          message = `${issue.minimum}以上の数値を入力してください。`;
        else message = `${issue.minimum}より多い数値を入力してください。`;
      } else if (issue.origin === "date") {
        if (issue.inclusive)
          message = `${new Date(Number(issue.minimum))} 以降の日時を入力してください。`;
        else
          message = `${new Date(Number(issue.minimum))}より後の日時を入力してください。`;
      } else message = "無効な入力です。";
      break;
    case "too_big":
      if (issue.origin === "array") {
        if (issue.inclusive)
          message = `${issue.maximum}個以下の要素を設定する必要があります。`;
        else
          message = `${issue.maximum}個より少ない要素を設定する必要があります。`;
      } else if (issue.origin === "string") {
        if (issue.inclusive)
          message = `${issue.maximum}文字以下で入力してください。`;
        else message = `${issue.maximum}文字より少なく入力してください。`;
      } else if (issue.origin === "number" || issue.origin === "bigint") {
        if (issue.inclusive)
          message = `${issue.maximum}以下の数値を入力してください。`;
        else message = `${issue.maximum}より小さい数値を入力してください。`;
      } else if (issue.origin === "date") {
        if (issue.inclusive)
          message = `${new Date(Number(issue.maximum))}以前の日時を入力してください。`;
        else
          message = `${new Date(Number(issue.maximum))}より前の日時を入力してください。`;
      } else message = "無効な入力です。";
      break;
    case "custom":
      message = issue.message || "無効な入力です。";
      break;
    case "not_multiple_of":
      message = `数値は${issue.divisor}の倍数を入力してください。`;
      break;
    case "invalid_key":
      message = `${issue.origin}内の無効なキー`;
      break;
    case "invalid_element":
      message = `${issue.origin}内の無効な値`;
      break;
    default:
      message = "無効な入力です。";
  }
  return { message };
};

// v4では z.config を使用
z.config({
  customError: jaErrorMap,
});
