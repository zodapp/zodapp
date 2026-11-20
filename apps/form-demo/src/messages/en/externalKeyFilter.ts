import { defineMessages } from "@zodapp/i18n-messages";

/** form-demo の英語の辞書（externalKeyFilter） */
export const en = defineMessages({
  "formDemo.page.externalKeyFilter.title": "zf.externalKey (filtering)",
  "formDemo.page.externalKeyFilter.description":
    'Filter a list by the signed-in user\'s department and so on. The list is fetched again when the condition changes. A value that drops out is cleared (clear) or kept with the error "(Invalid value)" (keep). Multi-select fields work the same way. In "Try it", choose when fetches arrive, make them fail, set the options to 0 items and back on the same subscription, and show a field with a missing topic',
  "formDemo.externalKeyFilter.assignee":
    "Assignee (filtered by the department chosen at the top; filter in context)",
  "formDemo.externalKeyFilter.assigneeKeep":
    "Assignee (unlisted: keep; keeps a value that drops out and shows it as invalid)",
  "formDemo.externalKeyFilter.watcherKey": "Watcher",
  "formDemo.externalKeyFilter.watchers":
    "Watchers (multiple; filtered by the department chosen at the top)",
  "formDemo.externalKeyFilter.watchersKeep":
    "Watchers (multiple; unlisted: keep)",
  "formDemo.externalKeyFilter.reviewer.resolve.schema":
    "Reviewer (filtered by the reviewing department)",
  "formDemo.externalKeyFilter.reviewTeam.sales": "Sales",
  "formDemo.externalKeyFilter.reviewTeam.dev": "Development",
  "formDemo.externalKeyFilter.reviewTeam": "Reviewing department",
  "formDemo.externalKeyFilter.missing": "Field with a missing topic",
  "formDemo.externalKeyFilter.try.team":
    "Department on screen (team in resolverContext)",
  "formDemo.externalKeyFilter.try.team.sales": "Sales",
  "formDemo.externalKeyFilter.try.team.dev": "Development",
  "formDemo.externalKeyFilter.try.description":
    'Choose when options arrive, or make fetches fail on purpose. Normally keep "Visible delay" (0.4 seconds). "Set options to 0" and "Restore options" re-deliver the options of the assignee and watcher fields without re-subscribing',
  "formDemo.externalKeyFilter.try.empty": "Set options to 0",
  "formDemo.externalKeyFilter.try.restore": "Restore options",
  "formDemo.externalKeyFilter.try.missing":
    "Show a field with a missing topic (its fetch fails and submission stops)",
});
