import { useMsg } from "@zodapp/i18n-messages-react";
import { Suspense, useMemo, type ComponentType } from "react";
import { useSearch } from "@tanstack/react-router";
import { Container, Tabs, Title, Text } from "@mantine/core";
import { CodeHighlight } from "@mantine/code-highlight";

import { AutoForm } from "../../components/AutoForm";
import { ReactiveAutoForm } from "../../components/ReactiveAutoForm";
import { formDetailRoute } from "./detail.route";
import { formSchemas, formCodes, defaultFormId, type FormId } from "./schemas";
import { e2eSchemas, e2eCodes, type E2eFormId } from "./schemas/e2e";
import {
  createE2eHarness,
  type HarnessWrite,
} from "../../components/E2eHarness";

import "@mantine/code-highlight/styles.css";
import { createMockFileResolver } from "@zodapp/zod-form";
import { useMemoryState } from "@zodapp/react-storage";
import {
  demoExternalKeyResolvers,
  demoValueActionResolver,
} from "../../shared/demo/resolvers";

type FormDef = (typeof formSchemas)[FormId] | (typeof e2eSchemas)[E2eFormId];

// メニューに出るデモと、e2e 用のデモ（メニューに出さない）の両方から引く
const allSchemas: Record<string, FormDef> = { ...formSchemas, ...e2eSchemas };
const allCodes: Record<string, string> = { ...formCodes, ...e2eCodes };
type ReactiveFormDef = Extract<FormDef, { reactive: true }>;

const isReactiveFormDef = (formDef: FormDef): formDef is ReactiveFormDef =>
  "reactive" in formDef && formDef.reactive === true;

// スキーマモジュールが Component を export している場合は、
// 汎用の AutoForm 描画の代わりにそのコンポーネントを表示する。
// （ビュー切替やカスタムアクションなど、AutoForm の props だけでは
// 表現できないデモに使う拡張ポイント）
const getCustomComponent = (formDef: FormDef): ComponentType | undefined =>
  "Component" in formDef && typeof formDef.Component === "function"
    ? (formDef.Component as ComponentType)
    : undefined;

// スキーマモジュールが harnessWrites を export している場合は、値を外から書き込むボタンを出す
const getHarnessWrites = (
  formDef: FormDef,
): readonly HarnessWrite[] | undefined =>
  "harnessWrites" in formDef && Array.isArray(formDef.harnessWrites)
    ? (formDef.harnessWrites as readonly HarnessWrite[])
    : undefined;

const FormPage = () => {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <FormPageInner />
    </Suspense>
  );
};

const FormPageInner = () => {
  const { formId: rawFormId } = useSearch({ from: formDetailRoute.id });
  const formId: string = rawFormId ?? defaultFormId;

  const formDef = allSchemas[formId]!;
  const { title, description } = formDef;
  const msg = useMsg();
  const isReactive = isReactiveFormDef(formDef);
  const CustomComponent = getCustomComponent(formDef);

  // ファイルフォーム用のresolver
  const fileResolvers = useMemo(() => [createMockFileResolver()], []);

  // 見るための部品（値・エラー・送信・ログ）。window.__formDemo にも同じ中身を置く
  const harnessWrites = getHarnessWrites(formDef);
  const harness = useMemo(
    () => [createE2eHarness({ formId, writes: harnessWrites })],
    [formId, harnessWrites],
  );

  // 「表示 / コード」のタブ。メモリに置くので、別のデモに移っても選んだタブのまま開く
  // （ページを読み込み直すと既定の「表示」に戻る）
  const [tab, setTab] = useMemoryState<string>("form-demo:detail-tab", "form");

  return (
    <Container size="lg">
      <Title order={2} mb="lg">
        {msg.resolve(title)}
      </Title>
      <Text c="dimmed" size="sm" mb="lg">
        {msg.resolve(description)}
      </Text>

      <Tabs value={tab} onChange={(value) => setTab(value ?? "form")}>
        <Tabs.List>
          <Tabs.Tab value="form">
            {msg("formDemo.app.detail.tabForm" /* i18n: 表示 */)}
          </Tabs.Tab>
          <Tabs.Tab value="code">
            {msg("formDemo.app.detail.tabCode" /* i18n: コード */)}
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="form" pt="md">
          <Suspense fallback={<div>Loading form...</div>}>
            {CustomComponent ? (
              <CustomComponent key={formId} />
            ) : isReactive ? (
              <ReactiveAutoForm
                schema={formDef.schema}
                values={formDef.defaultValues}
                key={formId}
                showPreview={true}
              />
            ) : (
              <AutoForm
                schema={formDef.schema}
                defaultValues={formDef.defaultValues}
                key={formId}
                fileResolvers={fileResolvers}
                externalKeyResolvers={demoExternalKeyResolvers}
                valueActionResolver={demoValueActionResolver}
                actionComponents={harness}
              />
            )}
          </Suspense>
        </Tabs.Panel>

        <Tabs.Panel value="code" pt="md">
          <CodeHighlight
            code={allCodes[formId] ?? ""}
            language="typescript"
            withCopyButton
          />
        </Tabs.Panel>
      </Tabs>
    </Container>
  );
};

export default FormPage;
