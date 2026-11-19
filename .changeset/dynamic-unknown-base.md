---
"@zodapp/zod-form": minor
"@zodapp/zod-form-widget": patch
---

**Breaking**：`zf.dynamic()` の土台を `z.never()` から `z.unknown()` にする。静的な schema の parse が dynamic の所で落ちなくなり、隣の欄や親の `.refine()` も走る（今までは黙って効かなかった）。`zf.dynamic()` の型は `never` から `unknown` になり、初期値を `unknown` 経由で型変換する必要がなくなる。値の検証は今どおり、実行時に決めた schema で行う。描かれていない（登録の無い）dynamic は、静的な検証では何でも通る
