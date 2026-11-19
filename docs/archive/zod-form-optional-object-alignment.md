# optional な object の縦位置と、空の検索条件の扱いを直す

今の仕様は [object の入れ物](../../packages/zod-form-mantine/docs/object.ja.md) の「optional・nullable な object」にあります。

## 目的

taskmanager の一覧の検索条件で、optional な object の欄（`name: optional(object({ $contains }))`、期限の From/To）に＋・削除が出て、隣の欄と下端がそろっていなかった。また、＋を押した直後や入力を消した後の値 `{ name: {} }` が mingo にそのまま渡り、「name が空 object と等しい」という条件になって 0 件になっていた。

## 決めたこと

- **optional な object の 0..1 の UI（＋・削除）は残し、横並び（下揃え）で隣の欄と下端がそろうように余白を直す。** 検索スキーマは、mingo のクエリと 1 対 1 の形（`q.name.$contains`）のまま変えない
- **空の検索条件は、アプリの `cleanQuery` で落とす。** 中身を落とした結果が空になった object も落とす（taskmanager と survey の `mingoQuery.ts`）
- 効いていなかった `uiType: "flatten"` は実装せず、スキーマから外す

## 採らなかった案

- **検索スキーマを平らにして、mingo への変換を別の層で行う。** ＋・削除もずれも根本から消えるが、mingo のクエリと 1 対 1 で対応する良さを失う
- **optional な object の下が「自分で空を表せる部品」なら、0..1 の UI を出さずに通す。** object には「空」を表す自然な値が無く（`{}` と `undefined` が同じかは用途による）、判定も再帰になるため
