---
"@zodapp/zod-form-mantine-lite": minor
---

pipe（`.transform()`・`.pipe()`・`z.codec()`・`z.stringbool()`）を、出口ではなく入口（`def.in`）の schema で描く。今までは `.transform()` で欄が出ず（Not found）、codec・stringbool などは出口の型の値を書き込んで「expected string」で送信できなかった。pipe 自体に付いた検査は outer で中に渡し、pipe に付けた label は入口の schema に label が無いときに使う。`z.stringbool()` は文字列の欄になる
