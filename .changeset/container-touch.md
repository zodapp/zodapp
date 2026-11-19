---
"@zodapp/zod-form-react": minor
"@zodapp/zod-form-mantine": patch
---

入れ物（object・intersection・array・record・union）が、子の欄を触ったこと・変えたことを自分のこととして扱う。入れ物の path のエラー（path を指定しない `.refine()`）は、入れ物から出たとき（最後の欄を離したとき・入れ物より後ろの欄にフォーカスしたとき）に出る。送信でエラーが出たあと子の欄を直すと、入れ物のエラーが消えて送り直せる。zod-form-react に `ContainerMarker` を足す
