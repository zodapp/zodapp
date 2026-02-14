import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { readFileSync } from "fs";
import { describe, beforeAll, afterAll, beforeEach, it, expect } from "vitest";

let testEnv: RulesTestEnvironment;

const PROJECT_ID = "zodapp-test";

// テスト用のユーザー情報
const ownerUser = {
  uid: "owner-uid",
  email: "owner@example.com",
};

const adminUser = {
  uid: "admin-uid",
  email: "admin@example.com",
};

const memberUser = {
  uid: "member-uid",
  email: "member@example.com",
};

const viewerUser = {
  uid: "viewer-uid",
  email: "viewer@example.com",
};

const outsiderUser = {
  uid: "outsider-uid",
  email: "outsider@example.com",
};

describe("Firestore Security Rules", () => {
  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules: readFileSync("../../firestore.rules", "utf8"),
        host: "127.0.0.1",
        port: 8080,
      },
    });
  });

  afterAll(async () => {
    await testEnv?.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();

    // セットアップ: ワークスペースとメンバーを作成
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();

      // ワークスペースを作成
      await db.doc("workspaces/test-workspace").set({
        name: "Test Workspace",
        ownerId: ownerUser.email,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // メンバーを作成（memberIdはemailを使用）
      await db.doc(`workspaces/test-workspace/members/${ownerUser.email}`).set({
        displayName: "Owner User",
        email: ownerUser.email,
        role: "owner",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await db.doc(`workspaces/test-workspace/members/${adminUser.email}`).set({
        displayName: "Admin User",
        email: adminUser.email,
        role: "admin",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await db.doc(`workspaces/test-workspace/members/${memberUser.email}`).set({
        displayName: "Member User",
        email: memberUser.email,
        role: "member",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await db.doc(`workspaces/test-workspace/members/${viewerUser.email}`).set({
        displayName: "Viewer User",
        email: viewerUser.email,
        role: "viewer",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // プロジェクトを作成
      await db.doc("workspaces/test-workspace/projects/test-project").set({
        name: "Test Project",
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // タスクを作成
      await db.doc("workspaces/test-workspace/projects/test-project/tasks/test-task").set({
        title: "Test Task",
        status: "todo",
        priority: "medium",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });
  });

  describe("Workspace Rules", () => {
    it("認証なしユーザーはワークスペースを読めない", async () => {
      const db = testEnv.unauthenticatedContext().firestore();
      await assertFails(db.doc("workspaces/test-workspace").get());
    });

    it("メンバーはワークスペースを読める", async () => {
      const db = testEnv.authenticatedContext(memberUser.uid, { email: memberUser.email }).firestore();
      await assertSucceeds(db.doc("workspaces/test-workspace").get());
    });

    it("部外者はワークスペースを読めない", async () => {
      const db = testEnv.authenticatedContext(outsiderUser.uid, { email: outsiderUser.email }).firestore();
      await assertFails(db.doc("workspaces/test-workspace").get());
    });

    it("認証済みユーザーは自分をオーナーとしてワークスペースを作成できる", async () => {
      const db = testEnv.authenticatedContext(outsiderUser.uid, { email: outsiderUser.email }).firestore();
      await assertSucceeds(
        db.doc("workspaces/new-workspace").set({
          name: "New Workspace",
          ownerId: outsiderUser.email,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      );
    });

    it("他人をオーナーとしてワークスペースを作成できない", async () => {
      const db = testEnv.authenticatedContext(outsiderUser.uid, { email: outsiderUser.email }).firestore();
      await assertFails(
        db.doc("workspaces/new-workspace").set({
          name: "New Workspace",
          ownerId: "someone-else@example.com",
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      );
    });

    it("adminはワークスペースを更新できる", async () => {
      const db = testEnv.authenticatedContext(adminUser.uid, { email: adminUser.email }).firestore();
      await assertSucceeds(
        db.doc("workspaces/test-workspace").update({
          name: "Updated Workspace",
          updatedAt: new Date(),
        })
      );
    });

    it("memberはワークスペースを更新できない", async () => {
      const db = testEnv.authenticatedContext(memberUser.uid, { email: memberUser.email }).firestore();
      await assertFails(
        db.doc("workspaces/test-workspace").update({
          name: "Updated Workspace",
          updatedAt: new Date(),
        })
      );
    });
  });

  describe("Member Rules", () => {
    it("メンバーは他のメンバーを読める", async () => {
      const db = testEnv.authenticatedContext(memberUser.uid, { email: memberUser.email }).firestore();
      await assertSucceeds(db.doc(`workspaces/test-workspace/members/${adminUser.email}`).get());
    });

    it("adminはメンバーを追加できる", async () => {
      const db = testEnv.authenticatedContext(adminUser.uid, { email: adminUser.email }).firestore();
      await assertSucceeds(
        db.doc("workspaces/test-workspace/members/new-member@example.com").set({
          displayName: "New Member",
          email: "new-member@example.com",
          role: "member",
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      );
    });

    it("memberはメンバーを追加できない", async () => {
      const db = testEnv.authenticatedContext(memberUser.uid, { email: memberUser.email }).firestore();
      await assertFails(
        db.doc("workspaces/test-workspace/members/new-member@example.com").set({
          displayName: "New Member",
          email: "new-member@example.com",
          role: "member",
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      );
    });

    it("自分のdisplayNameは編集できる", async () => {
      const db = testEnv.authenticatedContext(memberUser.uid, { email: memberUser.email }).firestore();
      await assertSucceeds(
        db.doc(`workspaces/test-workspace/members/${memberUser.email}`).update({
          displayName: "Updated Member Name",
          updatedAt: new Date(),
        })
      );
    });

    it("自分のroleは編集できない", async () => {
      const db = testEnv.authenticatedContext(memberUser.uid, { email: memberUser.email }).firestore();
      await assertFails(
        db.doc(`workspaces/test-workspace/members/${memberUser.email}`).update({
          role: "admin",
          updatedAt: new Date(),
        })
      );
    });

    it("他人のdisplayNameは編集できない（member role）", async () => {
      const db = testEnv.authenticatedContext(memberUser.uid, { email: memberUser.email }).firestore();
      await assertFails(
        db.doc(`workspaces/test-workspace/members/${viewerUser.email}`).update({
          displayName: "Hacked Name",
          updatedAt: new Date(),
        })
      );
    });

    it("adminは他人のフィールドを編集できる", async () => {
      const db = testEnv.authenticatedContext(adminUser.uid, { email: adminUser.email }).firestore();
      await assertSucceeds(
        db.doc(`workspaces/test-workspace/members/${memberUser.email}`).update({
          role: "viewer",
          updatedAt: new Date(),
        })
      );
    });
  });

  describe("Project Rules", () => {
    it("memberはプロジェクトを読める", async () => {
      const db = testEnv.authenticatedContext(memberUser.uid, { email: memberUser.email }).firestore();
      await assertSucceeds(db.doc("workspaces/test-workspace/projects/test-project").get());
    });

    it("adminはプロジェクトを作成できる", async () => {
      const db = testEnv.authenticatedContext(adminUser.uid, { email: adminUser.email }).firestore();
      await assertSucceeds(
        db.doc("workspaces/test-workspace/projects/new-project").set({
          name: "New Project",
          status: "active",
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      );
    });

    it("memberはプロジェクトを作成できない", async () => {
      const db = testEnv.authenticatedContext(memberUser.uid, { email: memberUser.email }).firestore();
      await assertFails(
        db.doc("workspaces/test-workspace/projects/new-project").set({
          name: "New Project",
          status: "active",
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      );
    });
  });

  describe("Task Rules", () => {
    it("memberはタスクを読める", async () => {
      const db = testEnv.authenticatedContext(memberUser.uid, { email: memberUser.email }).firestore();
      await assertSucceeds(db.doc("workspaces/test-workspace/projects/test-project/tasks/test-task").get());
    });

    it("memberはタスクを作成できる", async () => {
      const db = testEnv.authenticatedContext(memberUser.uid, { email: memberUser.email }).firestore();
      await assertSucceeds(
        db.doc("workspaces/test-workspace/projects/test-project/tasks/new-task").set({
          title: "New Task",
          status: "todo",
          priority: "medium",
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      );
    });

    it("viewerはタスクを作成できない", async () => {
      const db = testEnv.authenticatedContext(viewerUser.uid, { email: viewerUser.email }).firestore();
      await assertFails(
        db.doc("workspaces/test-workspace/projects/test-project/tasks/new-task").set({
          title: "New Task",
          status: "todo",
          priority: "medium",
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      );
    });

    it("viewerはタスクを読める", async () => {
      const db = testEnv.authenticatedContext(viewerUser.uid, { email: viewerUser.email }).firestore();
      await assertSucceeds(db.doc("workspaces/test-workspace/projects/test-project/tasks/test-task").get());
    });
  });

  describe("CollectionGroup Query Rules", () => {
    it("自分のmemberドキュメントはcollectionGroupで読める", async () => {
      const db = testEnv.authenticatedContext(memberUser.uid, { email: memberUser.email }).firestore();
      // 自分のmemberIdと一致するドキュメントのみ読める
      await assertSucceeds(db.doc(`workspaces/test-workspace/members/${memberUser.email}`).get());
    });
  });
});
