import {
  createMemoryHistory,
  createRouter,
  type RouterHistory,
} from "@tanstack/react-router";
import {
  encodeSearchParams,
  searchParamsToParamsTree,
} from "@zodapp/zod-searchparams";

import { homeRoute } from "./top/home/index.route";
import { formRoute } from "./form/index.route";
import { formDetailRoute } from "./form/detail.route";
import { formListRoute } from "./form/list.route";
import { rootRoute } from "./index.route";
import { topRoute } from "./top/index.route";

const routeTree = rootRoute.addChildren([
  topRoute.addChildren([homeRoute]),
  formRoute.addChildren([formListRoute, formDetailRoute]),
]);

const NotFound = () => <div>Not Found</div>;

export const createAppRouter = (history: RouterHistory) =>
  createRouter({
    routeTree,
    history,
    // GitHub Pages ではリポジトリ名のパスの下に置く（vite.config.ts の base）
    basepath: import.meta.env.BASE_URL,
    defaultNotFoundComponent: NotFound,
    stringifySearch: (search) => {
      const str = encodeSearchParams(search).toString();
      return str ? `?${str}` : "";
    },
    parseSearch: (searchStr) => {
      return searchParamsToParamsTree(new URLSearchParams(searchStr));
    },
  });

export const router = createAppRouter(createMemoryHistory());

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
