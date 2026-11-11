import { useMemo } from "react";

import { InputWrapper, MantineProvider, createTheme } from "@mantine/core";
import {
  CodeHighlightAdapterProvider,
  createShikiAdapter,
} from "@mantine/code-highlight";
import { RouterProvider, createBrowserHistory } from "@tanstack/react-router";

import { createAppRouter } from "./pages/router";
import { AuthProvider } from "./shared/auth";

// Shikiのハイライターを非同期で読み込む
async function loadShiki() {
  const { createHighlighter } = await import("shiki");
  const shiki = await createHighlighter({
    langs: ["tsx", "typescript", "javascript", "json", "bash", "html", "css"],
    themes: ["github-dark", "github-light"],
  });
  return shiki;
}

const shikiAdapter = createShikiAdapter(loadShiki);

// mantine 9 で入力欄のラベルが太字 (medium = 600) になった一方、Fieldset の見出しは
// 通常の太さのままなので、オブジェクトの入れ子で太字と通常が交互に並ぶ。
// ラベルを通常の太さに揃えて階層を読みやすくする。
// 太字に揃える場合は、label の指定を外して Fieldset の legend を 600 にする:
//   Fieldset: Fieldset.extend({ styles: { legend: { fontWeight: 600 } } }),
const theme = createTheme({
  components: {
    InputWrapper: InputWrapper.extend({
      styles: { label: { fontWeight: 400 } },
    }),
  },
});

export const App = () => {
  const router = useMemo(() => createAppRouter(createBrowserHistory()), []);

  return (
    <MantineProvider theme={theme}>
      <AuthProvider>
        <CodeHighlightAdapterProvider adapter={shikiAdapter}>
          <RouterProvider router={router} />
        </CodeHighlightAdapterProvider>
      </AuthProvider>
    </MantineProvider>
  );
};
