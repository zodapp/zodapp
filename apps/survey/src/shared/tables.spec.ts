/**
 * 共有の定義（Table定義・操作・認可）を DynamoDB Local で確かめる。
 * `pnpm infra:up` で DynamoDB Local を起動してから実行する。
 */
import { randomUUID } from "node:crypto";
import { DeleteTableCommand } from "@aws-sdk/client-dynamodb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDynamoClient, ensureTable } from "../server/dynamo";
import { createServerApi } from "@zodapp/zod-dynamodb-node";
import { createAppRepository, type AppRepository } from "../server/repository";
import { appTable, endpoints, type Auth } from "./index";
import { fromStoredAnswers, toStoredAnswers } from "./survey/answers";
import { surveyFixtures } from "./survey/fixtures";
import { generateDummyAnswers } from "./survey/generateDummyAnswers";

const dynamodb = createDynamoClient();
const tableName = `test-${randomUUID()}`;
let repo: AppRepository;
let api: ReturnType<typeof createServerApi<typeof endpoints, unknown>>;

const alice: Auth = { userId: "u-alice", email: "alice@example.com", roles: { ws1: "owner" } };
const viewer: Auth = { userId: "u-vic", email: "vic@example.com", roles: { ws1: "viewer" } };
const outsider: Auth = { userId: "u-eve", email: "eve@example.com", roles: {} };

beforeAll(async () => {
  await ensureTable(dynamodb, appTable, tableName);
  repo = createAppRepository({ dynamodb, tableName });
  api = createServerApi(endpoints, { repository: repo });
});
afterAll(async () => {
  await dynamodb.send(new DeleteTableCommand({ TableName: tableName }));
});

const member: Auth = { userId: "u-bob", email: "bob@example.com", roles: { ws1: "member" } };

describe("surveys", () => {
  it("作成は下書き・版 0。active と deleted を deletedAt で分ける", async () => {
    const args = { workspaceId: "ws1" };
    const a = await api.surveys.create(args, { title: "A", fields: [] }, { context: alice });
    const b = await api.surveys.create(args, { title: "B", fields: [] }, { context: alice });
    expect(a).toMatchObject({ status: "draft", revision: 0, deletedAt: null });
    await api.surveys.softDelete({ workspaceId: "ws1", surveyId: b.surveyId }, {}, { context: alice });

    const active = await api.surveys.active(args, { context: viewer });
    const deleted = await api.surveys.deleted(args, { context: viewer });
    expect(active.items.map((s) => s.surveyId)).toContain(a.surveyId);
    expect(active.items.map((s) => s.surveyId)).not.toContain(b.surveyId);
    expect(deleted.items.map((s) => s.surveyId)).toEqual([b.surveyId]);
  });

  it("公開のたびに版が上がる。終了と再開は状態を確かめてから", async () => {
    const s = await api.surveys.create({ workspaceId: "ws1" }, { title: "P", fields: [] }, { context: member });
    const key = { workspaceId: "ws1", surveyId: s.surveyId };
    // 公開していないものは終了できない
    await expect(api.surveys.close(key, {}, { context: member })).rejects.toThrow();
    expect(await api.surveys.publish(key, {}, { context: member })).toMatchObject({ status: "published", revision: 1 });
    expect(await api.surveys.publish(key, {}, { context: member })).toMatchObject({ revision: 2 });
    expect(await api.surveys.close(key, {}, { context: member })).toMatchObject({ status: "closed" });
    expect(await api.surveys.reopen(key, {}, { context: member })).toMatchObject({ status: "published" });
  });

  it("フィクスチャを put で何度でも入れられる", async () => {
    for (const fixture of surveyFixtures) {
      const key = { workspaceId: "ws2", surveyId: fixture.surveyId };
      await api.surveys.put(key, { ...fixture.data, ...key }, { context: { ...alice, roles: { ws2: "owner" } } });
      await api.surveys.put(key, { ...fixture.data, ...key }, { context: { ...alice, roles: { ws2: "owner" } } });
    }
    const all = await api.surveys.active({ workspaceId: "ws2" }, { context: { ...alice, roles: { ws2: "owner" } } });
    expect(all.items).toHaveLength(surveyFixtures.filter((f) => f.data.deletedAt === null).length);
  });

  it("viewer は作れず、所属しない人は読めない", async () => {
    await expect(
      api.surveys.create({ workspaceId: "ws1" }, { title: "X", fields: [] }, { context: viewer }),
    ).rejects.toThrow();
    await expect(api.surveys.active({ workspaceId: "ws1" }, { context: outsider })).rejects.toThrow();
  });
});

describe("responses", () => {
  it("回答を保存し、アンケートごとと全体で引ける。日付は文字列で行き来する", async () => {
    const fixture = surveyFixtures[0]!;
    const s = await api.surveys.create(
      { workspaceId: "ws1" },
      { title: "R", fields: fixture.fields },
      { context: alice },
    );
    const { answers } = generateDummyAnswers(fixture.fields, 1);
    const stored = toStoredAnswers(fixture.fields, answers);
    const r = await api.responses.create(
      { workspaceId: "ws1" },
      {
        surveyId: s.surveyId,
        surveyRevision: 1,
        respondentId: viewer.email,
        answers: stored,
        submittedAt: new Date("2026-03-01T00:00:00Z"),
      },
      { context: viewer },
    );
    const got = await api.responses.get({ workspaceId: "ws1", responseId: r.responseId }, { context: alice });
    expect(got?.answers).toEqual(stored);
    expect(fromStoredAnswers(fixture.fields, got?.answers)).toEqual(
      fromStoredAnswers(fixture.fields, stored),
    );

    const bySurvey = await api.responses.bySurvey({ workspaceId: "ws1", surveyId: s.surveyId }, { context: alice });
    expect(bySurvey.items.map((x) => x.responseId)).toEqual([r.responseId]);
    const all = await api.responses.all({ workspaceId: "ws1" }, { context: alice });
    expect(all.items.map((x) => x.responseId)).toContain(r.responseId);

    // 削除は管理者だけ
    await expect(
      api.responses.remove({ workspaceId: "ws1", responseId: r.responseId }, { context: member }),
    ).rejects.toThrow();
    await api.responses.remove({ workspaceId: "ws1", responseId: r.responseId }, { context: alice });
  });
});

describe("members", () => {
  it("email から所属一覧を引ける", async () => {
    for (const workspaceId of ["ws1", "ws2"]) {
      await repo.members.create(
        { workspaceId, email: "alice@example.com" },
        { displayName: "Alice", role: workspaceId === "ws1" ? "owner" : "member" },
      );
    }
    const mine = await api.members.mine({}, { context: alice });
    expect(mine.items.map((m) => [m.workspaceId, m.role])).toEqual([
      ["ws1", "owner"],
      ["ws2", "member"],
    ]);
  });
});

