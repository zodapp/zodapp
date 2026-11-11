# zod-transform: intersection のマージの修正プラン

- ステータス: プラン（実装未着手）
- 対象ブランチ: `claude/zod-transform-intersection`（このプランと同じブランチに実装を積む）
- 対象パッケージ: `@zodapp/zod-transform`（影響を受ける利用側: `zod-transport-json`、`zod-form`、`zod-searchparams`、`zod-tabular`）

---

## 1. 背景と原因

`packages/zod-transform/src/index.ts` の `intersection` ハンドラは、left と right を
同じ元の値から別々に transform し、次のように浅くマージしている。

```ts
return {
  ...$Remove.stripRemoveByDefault(context.transform(obj, left), undefined),
  ...$Remove.stripRemoveByDefault(context.transform(obj, right), undefined),
};
```

一方 `object` ハンドラは、shape にないキーを変換せずにそのまま通す。そのため、

```ts
const schema = z.object({ a: z.date() }).and(z.object({ b: z.string() }));
```

で `a` を変換する場合、left は `a` を変換するが、right は `a` を元の値のまま通し、
浅いマージで right の変換前の値が left の変換結果を上書きする。
結果として、intersection の left 側の変換が実質的に効かない。

あわせて、次の問題もある。

- **同じキーの中で別々のフィールドを変換する場合**:
  `z.object({ meta: z.object({ x: z.date() }) }).and(z.object({ meta: z.object({ y: z.date() }) }))`
  では、`meta` を両側が知っているので、どちらを採っても片方の変換が失われる
- **`$remove`**: left が `$remove` で取り除いたキーも、right がそのキーを通すと復活する
  （現在は README とヘッダーコメントの「intersection のマージ仕様」に、これが仕様として書かれている）
- intersection のテストが `zod-transform` に 1 件もない

利用側では、intersection を平らな object に組み直して回避している例がある。

## 2. 方針（確定）

1. **元の値との差分でマージする**。Schema を解析してキーを分けるのではなく、
   left・right の結果を元の値と比べ、変わった側を採る。union、lazy、pipe、catchall、
   record が混ざっても同じ規則で動く
2. **片側が取り除き、もう片側が値を通しただけなら、取り除く**（「right にあれば復活する」仕様をやめる）
3. **両側が別々の値に変換して食い違ったら、right を優先する**（現行と同じ）

## 3. マージの規則

`mergeIntersection(original, left, right)` を新設し、`intersection` ハンドラはこれを返す。
比較は `Object.is` で行う。

1. `left` が `original` と同じなら `right` を返す（left は何もしていない）
2. `right` が `original` と同じなら `left` を返す（right は何もしていない）
3. `original`・`left`・`right` がすべて plain object なら、キーごとにマージした新しい
   object（`Object.create(null)`、`object` ハンドラと同じ）を返す。キーは left と right の和集合
   - 両側にある: `mergeIntersection(original[k], left[k], right[k])` で再帰
   - 片側にだけあり、`original` にもある（もう片側が取り除いた）:
     - 残っている側が値を通しただけ（`original[k]` と同じ）なら、取り除く（方針 2）
     - 残っている側も変換していたら食い違いとし、right を優先する
       （right が残していれば残し、right が取り除いていれば取り除く）
   - 片側にだけあり、`original` にない（片側が足した）: その値を採る
   - どちらにもない: 取り除く
4. `original`・`left`・`right` がすべて配列で、長さが同じなら、要素ごとに再帰でマージした新しい配列を返す。
   長さが違う（片側の `$remove` で要素が詰められた）場合は食い違いとして right を採る
5. それ以外（両側が別々の値に変換した）: `right` を採る（方針 3）

### 3.1 補足

- `object` ハンドラは変換しなくても新しい object を作るので、plain object は常に「変わった」と
  判定され、規則 3 の再帰に入る。葉の値（プリミティブ、`Date` などのクラスインスタンス）は、
  通しただけなら同一参照のままなので、規則 1・2 で判定できる
- 片側の結果が intersection 自体に対する `$remove`（`$Remove` のインスタンス）の場合も、
  値として同じ規則で扱う。もう片側が値を通しただけなら `$remove` を返し、上位
  （object・array など）の `$remove` の扱いに任せる。現在は intersection の位置で
  `undefined` に置き換えて無視しているので、ここも挙動が変わる
- `Object.is` での比較なので、変換の結果が元と同じ値（例: 文字列を同じ文字列に変換）なら
  「変えていない」とみなす。結果は同じなので問題にならない

## 4. 変更するファイル

| ファイル | 変更 |
| --- | --- |
| `packages/zod-transform/src/index.ts` | `mergeIntersection` を追加し、`intersection` ハンドラを差し替える。ヘッダーコメントの「4. intersection のマージ仕様」を新しい規則に書き換える |
| `packages/zod-transform/README.ja.md`（英語版があれば両方） | 「intersection のマージ仕様」を書き換える |
| `packages/zod-transform/src/index.spec.ts` | intersection のテストを追加（§5） |
| `packages/zod-transport-json/src/index.spec.ts` | intersection を含む Schema の往復（encode → decode）のテストを追加 |
| `CHANGELOG.ja.md` / `CHANGELOG.md` | 未リリースに「zod-transform: intersection の left 側の変換が right の素通しで上書きされる不具合を修正。`$remove` の扱いを変更」を追記 |

## 5. テスト

`zod-transform`（preprocess と postprocess の両方で確認する）

1. left だけが知っているキーの変換が残る（`{ a: Date } & { b: string }` で `a` が変換される）
2. right だけが知っているキーの変換が残る
3. 同じキーの中の別々のフィールド（`meta.x` と `meta.y`）が両方変換される
4. 両側が同じキーを同じ規則で変換する場合、結果が 1 回分の変換になる
5. 両側が同じキーを別々の値に変換した場合、right が採られる
6. left が `$remove` したキーを right が通しただけなら、取り除かれる（right 側も同様）
7. left が変換し、right が `$remove` した場合は取り除かれる（right 優先）
8. union を含む intersection（`z.union([...]).and(z.object(...))`）で、選ばれた選択肢の変換が残る
9. 配列を含む intersection で、要素ごとの変換が両側とも残る
10. ネストした intersection（`A.and(B).and(C)`）
11. 元の object にないキーを片側が足した場合、そのキーが残る
12. intersection の値が object でない場合は、今と同じくそのまま返す

`zod-transport-json`

- `z.object({ createdAt: z.date() }).and(z.object({ id: z.string() }))` を encode → decode して元に戻る
- 片側が discriminated union の intersection でも往復できる

## 6. 確認

AGENT.md に従い、次を通す。

```bash
pnpm check-types
pnpm build
pnpm test
pnpm lint
```

## 7. 範囲外（後続）

- 利用側の回避の削除（この修正が使えるようになってから、利用側の別の作業で行う）
- zodapp パッケージの npm 公開
