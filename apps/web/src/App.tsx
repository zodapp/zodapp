import { useMemo } from "react";

import { MantineProvider } from "@mantine/core";
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

export const App = () => {
  const router = useMemo(() => createAppRouter(createBrowserHistory()), []);

  return (
    <MantineProvider>
      <AuthProvider>
        <CodeHighlightAdapterProvider adapter={shikiAdapter}>
          <RouterProvider router={router} />
        </CodeHighlightAdapterProvider>
      </AuthProvider>
    </MantineProvider>
  );
};
