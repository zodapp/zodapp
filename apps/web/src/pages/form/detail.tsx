import { Suspense, useMemo } from "react";
import { useSearch } from "@tanstack/react-router";
import { Container, Tabs, Title, Text } from "@mantine/core";
import { CodeHighlight } from "@mantine/code-highlight";

import { AutoForm } from "../../components/AutoForm";
import { formDetailRoute } from "./detail.route";
import { formSchemas, formCodes, defaultFormId, type FormId } from "./schemas";

import "@mantine/code-highlight/styles.css";
import { createMockFileResolver } from "@zodapp/zod-form";

const FormPage = () => {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <FormPageInner />
    </Suspense>
  );
};

const FormPageInner = () => {
  const { formId: rawFormId } = useSearch({ from: formDetailRoute.id });
  const formId = (rawFormId as FormId) ?? defaultFormId;

  const { schema, defaultValues, title, description } = formSchemas[formId];

  // ファイルフォーム用のresolver
  const fileResolvers = useMemo(() => [createMockFileResolver()], []);

  return (
    <Container size="lg">
      <Title order={2} mb="lg">
        {title}
      </Title>
      <Text c="dimmed" size="sm" mb="lg">
        {description}
      </Text>

      <Tabs defaultValue="form">
        <Tabs.List>
          <Tabs.Tab value="form">表示</Tabs.Tab>
          <Tabs.Tab value="code">コード</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="form" pt="md">
          <Suspense fallback={<div>Loading form...</div>}>
            <AutoForm
              schema={schema}
              defaultValues={defaultValues}
              key={formId}
              fileResolvers={fileResolvers}
              showPreview={true}
            />
          </Suspense>
        </Tabs.Panel>

        <Tabs.Panel value="code" pt="md">
          <CodeHighlight
            code={formCodes[formId]}
            language="typescript"
            withCopyButton
          />
        </Tabs.Panel>
      </Tabs>
    </Container>
  );
};

export default FormPage;
