declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

interface ImportMeta {
  readonly env: Record<string, string | undefined>;
}
