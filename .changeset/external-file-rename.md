---
"@zodapp/zod-form": minor
"@zodapp/zod-form-mantine": minor
---

**Breaking**：`zf.file` を `zf.externalFile` に改名する。typeName と `componentLibrary` のキーも `"externalFile"` になり、型 `FileMetaDef` は `ExternalFileMetaDef`、部品 `FileComponent` は `ExternalFileComponent` になる。文言のキー `zodFormMantine.file.*`（`remove`・`dropzone`・`maxSize`）は `zodFormMantine.externalFile.*` になる。`zf.file` は互換の別名として残さない。`fileConfig`・`FileResolvers` などの設定の名前は変えない。値・検証は変わらない（`z.string()` に meta を付けたもの）。今までは `z.file()` が zf.file の部品に当たり、フォームごと落ちていた。改名のあと `z.file()` は部品の無い型になる
