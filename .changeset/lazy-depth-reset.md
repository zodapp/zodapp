---
"@zodapp/zod-form-mantine-lite": patch
"@zodapp/zod-form-mantine": patch
---

`z.lazy` の入れ子の深さの上限（既定 10、`maxDepth`）で数えるのを、optional の付かない lazy の連なりだけにした。値が無ければ中を描かない部品（optional・nullable な object・intersection の 0..1 の枠、array・record の entries・Map・union）を通ったら数え直す。optional・nullable の包み自体では数え直さない（tuple・キーの決まった record は値が無くても中を描くため）（`maxDepth` は引き継ぐ）。今までは optional な再帰でも、上限より深い値の所に注記が出ていた。関数で深さを決めた optional なしの再帰は、今までどおり上限まで描く。mantine-lite の `baseComponents` に `ResetLazyDepth`・`withResetLazyDepth` を足した
