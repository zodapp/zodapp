import { Card, SimpleGrid, Text, Title, Badge, Group } from "@mantine/core";
import { useNavigate } from "@tanstack/react-router";

import { formSchemas, formIds, type FormId } from "./schemas";
import { formDetailRoute } from "./detail.route";

const FormListPage = () => {
  const navigate = useNavigate();

  const handleCardClick = (formId: FormId) => {
    navigate({ to: formDetailRoute.to, search: { formId } });
  };

  return (
    <div className="p-4 sm:p-8">
      <Title order={2} mb="lg">
        スキーマ一覧
      </Title>
      <Text c="dimmed" mb="xl">
        Zodスキーマから自動生成されるフォームのサンプル集です。カードをクリックして詳細を確認できます。
      </Text>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
        {formIds.map((formId) => {
          const schema = formSchemas[formId];
          return (
            <Card
              key={formId}
              shadow="sm"
              padding="lg"
              radius="md"
              withBorder
              style={{ cursor: "pointer", minHeight: "150px" }}
              onClick={() => handleCardClick(formId)}
            >
              <Group justify="space-between" mb="xs">
                <Group gap="xs">
                  <schema.icon size={20} />
                  <Text fw={500}>{schema.title}</Text>
                </Group>
                <Badge color="blue" variant="light">
                  {schema.category}
                </Badge>
              </Group>

              <Text size="sm" c="dimmed" lineClamp={2}>
                {schema.description}
              </Text>
            </Card>
          );
        })}
      </SimpleGrid>
    </div>
  );
};

export default FormListPage;
