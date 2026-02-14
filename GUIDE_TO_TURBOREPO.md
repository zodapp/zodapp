# 新しいパッケージの追加方法

## パッケージ側

packages/\_/eslint.config.mjs
→他のパッケージからのコピーでOK。
ただし、jsxを使う場合と使わない場合で、import元が違うので注意
"@repo/eslint-config/base"
"@repo/eslint-config/react-internal"

packages/\_/tsconfig.json
→→他のパッケージからのコピーでOK。
ただし、jsxを使う場合と使わない場合で、extend元が違うので注意
"@repo/typescript-config/base.json"
"@repo/typescript-config/react-library.json"

packages/\*/package.json
→name設定が重要。この設定がimport時のパスを決める。
→exports設定が正しくされている必要がある。
例：
".": "src/index.ts"
"./_": "./src/_.ts"

## 反映

ルートでnpm i することで、npmがルートのpackage.jsonに指定されたworkspacesディレクトリ(packages/\*等)をトラバースして、ルートのnode_modulesにシンボリックリンクが作成される

## 読み込み側

package.jsonのdependenciesに追加する
この際の名前は、package.jsonのnameと一致する必要がある。
