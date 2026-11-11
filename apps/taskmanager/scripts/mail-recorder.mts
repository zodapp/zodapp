/**
 * 開発用のメールの記録。
 *
 * magnito（Cognito のエミュレーター）が送る確認コードやパスワード再設定のメールを SMTP で受け取り、
 * コンソールに出す。HTTP で宛先ごとの最新のメールも返す（E2E のテストが確認コードを取るため）。
 *
 *   GET /messages?to=alice@example.com  → その宛先のメール（新しい順）
 *   GET /messages/latest?to=...         → 最新の 1 通（なければ 404）
 *   DELETE /messages                    → すべて消す
 */
import { createServer } from "node:http";
import { simpleParser } from "mailparser";
import { SMTPServer } from "smtp-server";

export type RecordedMail = {
  to: string[];
  from: string;
  subject: string;
  text: string;
  receivedAt: string;
};

const smtpPort = Number(process.env.MAIL_SMTP_PORT ?? 2500);
const httpPort = Number(process.env.MAIL_HTTP_PORT ?? 2501);
const mails: RecordedMail[] = [];

const addresses = (value: unknown): string[] => {
  const list = Array.isArray(value) ? value : value ? [value] : [];
  return list.flatMap((v: { value?: { address?: string }[] }) =>
    (v.value ?? []).map((a) => (a.address ?? "").toLowerCase()),
  );
};

const smtp = new SMTPServer({
  authOptional: true,
  disabledCommands: ["STARTTLS"],
  onAuth: (_auth, _session, callback) => callback(null, { user: "local" }),
  onData: (stream, _session, callback) => {
    simpleParser(stream)
      .then((parsed) => {
        const mail: RecordedMail = {
          to: addresses(parsed.to),
          from: addresses(parsed.from).join(", "),
          subject: parsed.subject ?? "",
          text: parsed.text ?? (typeof parsed.html === "string" ? parsed.html : ""),
          receivedAt: new Date().toISOString(),
        };
        mails.push(mail);
        console.log(
          `[mail] to=${mail.to.join(",")} subject=${JSON.stringify(mail.subject)}\n${mail.text.trim()}\n`,
        );
        callback();
      })
      .catch((error: Error) => callback(error));
  },
});

smtp.listen(smtpPort, "0.0.0.0", () =>
  console.log(`[mail] SMTP on :${smtpPort}, HTTP on :${httpPort}`),
);

createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const to = url.searchParams.get("to")?.toLowerCase();
  const matching = mails
    .filter((m) => !to || m.to.includes(to))
    .slice()
    .reverse();
  res.setHeader("content-type", "application/json");
  if (req.method === "DELETE" && url.pathname === "/messages") {
    mails.length = 0;
    res.end("{}");
  } else if (url.pathname === "/messages/latest") {
    if (matching[0]) res.end(JSON.stringify(matching[0]));
    else {
      res.statusCode = 404;
      res.end("{}");
    }
  } else if (url.pathname === "/messages") {
    res.end(JSON.stringify(matching));
  } else {
    res.statusCode = 404;
    res.end("{}");
  }
}).listen(httpPort, "0.0.0.0");
