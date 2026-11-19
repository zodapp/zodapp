# 最近の機能のデモと e2e を form-demo に足す

## 目的

PR #28〜#34 で入った機能の多くが、form-demo（e2e のベース）で試せなかった。あわせて、optional な再帰の深い値にも lazy の上限の注記が出ていたのを直す。上限は optional の付かない再帰のための安全装置なのに、ルートからの lazy をすべて数えていたため。

## 決めたこと

- **利用者が画面で触る UI はメニューに出るデモに置き、画面で触らない機能（送信値の変換・そのまま送る型・扱えない型の注記など）は、メニューに出ない e2e 用のページと spec だけにする。** e2e 用のページは formId を `e2e-` で始める
- **lazy の上限で数えるのは、値が無くても中を描く所だけで続く lazy の連なりにする。** 値が無ければ中を描かない部品（optional な object の 0..1 の枠、array、record の entries・Map、union）を通ったら数え直す。そこから先は値の深さで止まるため。optional の包み自体では数え直さない（中が tuple やキーの決まった record なら、値が無くても中を描くので、`z.lazy(() => z.tuple([node.optional()]))` のような再帰が止まらなくなる）

今の lazy の数え方は [zod の型ごとの描き方](../../packages/zod-form-mantine/docs/schema-types.ja.md) にあります。
