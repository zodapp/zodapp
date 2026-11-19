---
"@zodapp/zod-transform": minor
"@zodapp/zod-form": minor
"@zodapp/zod-form-react": minor
"@zodapp/zod-form-mantine-lite": minor
"@zodapp/zod-form-mantine": minor
"@zodapp/zod-form-widget": minor
---

残りの非対応スキーマに対応する。

- `zf.computed()` は初めから optional を含む（`.optional()` を付けなくても、キーが無くて検証を通す）
- enum の選択肢：object の形で書いた enum（`z.enum({ A: 1 })`・TS enum）は、label が無ければキーを名前にする。検証を通らない値（数値の TS enum の逆引きのキー）は選択肢から外す
- `.readonly()`・`.catch()`・`.nonoptional()`・`.prefault()` は、包みを外して中を描く。`getDefaultValue` は prefault の値と、`z.nan()` の NaN を入れる。zod-transform に prefault・nonoptional の processor を足す
- `z.any()`・`z.unknown()`・`z.custom()`・`z.symbol()`・`z.function()`・`z.never()` は欄を出さず、値をそのまま送る（エラーがあればエラーだけ出す）。`z.nan()` は固定値として扱う
- `z.templateLiteral()` は文字列の欄、`z.file()` は FileInput、`z.map()` は record の entries と同じ見た目で描く
- 部品の無い型は、「Component not found」の代わりに、辞書の文言の「扱えない」注記と console.error（型の名前を入れる）を出す。zod-form-mantine に `UnsupportedSchemaNotice` を足し、AutoForm・ReactiveAutoForm・AutoSearch で使う
- `FormRuntime` は、`z.promise()`・async の refine で zod が投げる例外を握り、送信が止まった理由として出す（`ASYNC_VALIDATION_ISSUE_CODE`）
- optional の付かない再帰（`z.lazy`）は、lazy の入れ子の深さの上限（既定 10、`zf.common.registry` の meta の `maxDepth` で変える）で止め、注記を出す
- record の entries と Map で、値に入っている組のキーを不正な書きかけ（空・重複・キーの schema に通らない）にしたら、直すまでその組を値から外す（画面と違う古いキーのまま送らない）。キーを直すと、持っておいた値で元の位置に戻す
