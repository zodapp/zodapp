# How to add a new package

## The package side

packages/\_/eslint.config.mjs
→ Copying it from another package is fine.
However, the import source differs depending on whether JSX is used:
"@repo/eslint-config/base"
"@repo/eslint-config/react-internal"

packages/\_/tsconfig.json
→ Copying it from another package is fine.
However, what it extends differs depending on whether JSX is used:
"@repo/typescript-config/base.json"
"@repo/typescript-config/react-library.json"

packages/\*/package.json
→ The name setting matters. It decides the path used when importing.
→ The exports setting must be correct.
Example:
".": "src/index.ts"
"./_": "./src/_.ts"

## Applying it

Running the install at the root traverses the workspace directories given in the root package.json (packages/\*, etc.), and creates symbolic links in the root node_modules.

## The importing side

Add it to dependencies in package.json.
The name must match the name in the package's package.json.
