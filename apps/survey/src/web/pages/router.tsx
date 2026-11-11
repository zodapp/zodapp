import {
  createMemoryHistory,
  createRouter,
  type RouterHistory,
} from "@tanstack/react-router";
import {
  encodeSearchParams,
  searchParamsToParamsTree,
} from "@zodapp/zod-searchparams";

import { surveyRoute } from "./survey-top/index.route";
// non-member routes (public)
import { nonMemberLayoutRoute } from "./survey-nonmember/layout.route";
import { loginRoute } from "./survey-nonmember/login.route";
import { passwordResetRoute } from "./survey-nonmember/passwordReset.route";
// top level routes
import { topLayoutRoute } from "./survey-top/layout.route";
import { workspacesRoute } from "./survey-top/workspaces.route";
// workspace level routes
import { workspaceLayoutRoute } from "./survey-workspace/layout.route";
import { workspaceDetailRoute } from "./survey-workspace/detail.route";
import { membersRoute } from "./survey-workspace/members.route";
import { memberDetailRoute } from "./survey-workspace/member/detail.route";
import { surveysRoute } from "./survey-workspace/surveys.route";
import { surveyEditRoute } from "./survey-workspace/survey/edit.route";
import { responsesRoute } from "./survey-workspace/responses.route";
import { responseDetailRoute } from "./survey-workspace/response/detail.route";
import { surveyTestDataRoute } from "./survey-workspace/testData.route";
// respondent routes (no sidebar)
import { surveyPublicLayoutRoute } from "./survey-public/layout.route";
import { surveyAnswerRoute } from "./survey-public/answer.route";
import { rootRoute } from "./index.route";
import { topRoute } from "./top.route";

const routeTree = rootRoute.addChildren([
  topRoute,
  surveyRoute.addChildren([
    // non-member routes (public - no auth required)
    nonMemberLayoutRoute.addChildren([loginRoute, passwordResetRoute]),
    // respondent routes (auth required, no sidebar)
    surveyPublicLayoutRoute.addChildren([surveyAnswerRoute]),
    // protected routes (auth required)
    topLayoutRoute.addChildren([workspacesRoute]),
    workspaceLayoutRoute.addChildren([
      surveysRoute,
      surveyEditRoute,
      responsesRoute,
      responseDetailRoute,
      surveyTestDataRoute,
      membersRoute,
      memberDetailRoute,
      workspaceDetailRoute,
    ]),
  ]),
]);

const NotFound = () => <div>Not Found</div>;

export const createAppRouter = (history: RouterHistory) =>
  createRouter({
    routeTree,
    history,
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
