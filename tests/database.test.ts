import { describe, test, expect, beforeEach } from "bun:test";
import { eq } from "drizzle-orm";
import { createTestDatabase, factories } from "./utils";
import * as schema from "../src/db/schema";

describe("Database Schema Tests", () => {
  let db: ReturnType<typeof createTestDatabase>["db"];
  let sqlite: ReturnType<typeof createTestDatabase>["sqlite"];

  beforeEach(() => {
    const testDb = createTestDatabase();
    db = testDb.db;
    sqlite = testDb.sqlite;
  });

  describe("User Table", () => {
    test("should create and retrieve a user", async () => {
      const newUser = factories.user();

      const result = await db.insert(schema.user).values(newUser).returning();

      expect(result[0]).toBeDefined();
      expect(result[0]?.id).toBe(newUser.id);
      expect(result[0]?.name).toBe(newUser.name);
      expect(result[0]?.email).toBe(newUser.email);
      expect(result[0]?.emailVerified).toBe(false);
    });

    test("should enforce unique email constraint", async () => {
      const user1 = factories.user();
      const user2 = factories.user({ email: user1.email });

      await db.insert(schema.user).values(user1);

      try {
        await db.insert(schema.user).values(user2);
        throw new Error("Should have thrown unique constraint error");
      } catch (error: any) {
        expect(error.message).toContain("UNIQUE");
      }
    });

    test("should update user", async () => {
      const user = factories.user();
      await db.insert(schema.user).values(user);

      const newName = "Updated Name";
      const result = await db
        .update(schema.user)
        .set({ name: newName, updatedAt: new Date() })
        .where(eq(schema.user.id, user.id))
        .returning();

      expect(result[0]?.name).toBe(newName);
    });

    test("should delete user", async () => {
      const user = factories.user();
      await db.insert(schema.user).values(user);

      await db.delete(schema.user).where(eq(schema.user.id, user.id));

      const result = await db
        .select()
        .from(schema.user)
        .where(eq(schema.user.id, user.id))
        .limit(1);

      expect(result.length).toBe(0);
    });

    test("should create user with all fields", async () => {
      const user = factories.user({
        name: "Complete User",
        email: "complete@example.com",
        emailVerified: true,
        image: "https://example.com/avatar.jpg",
      });

      const result = await db.insert(schema.user).values(user).returning();

      expect(result[0]?.emailVerified).toBe(true);
      expect(result[0]?.image).toBe("https://example.com/avatar.jpg");
    });
  });

  describe("Session Table", () => {
    test("should create and retrieve a session", async () => {
      const user = factories.user();
      await db.insert(schema.user).values(user);

      const newSession = factories.session(user.id);

      const result = await db.insert(schema.session).values(newSession).returning();

      expect(result[0]).toBeDefined();
      expect(result[0]?.userId).toBe(user.id);
      expect(result[0]?.token).toBe(newSession.token);
    });

    test("should enforce foreign key constraint on user_id", async () => {
      const session = factories.session("non-existent-user");

      try {
        await db.insert(schema.session).values(session);
        throw new Error("Should have thrown foreign key constraint error");
      } catch (error: any) {
        expect(error.message).toContain("FOREIGN KEY");
      }
    });

    test("should cascade delete sessions when user is deleted", async () => {
      const user = factories.user();
      await db.insert(schema.user).values(user);

      const session1 = factories.session(user.id);
      const session2 = factories.session(user.id);
      await db.insert(schema.session).values([session1, session2]);

      await db.delete(schema.user).where(eq(schema.user.id, user.id));

      const sessions = await db
        .select()
        .from(schema.session)
        .where(eq(schema.session.userId, user.id));

      expect(sessions.length).toBe(0);
    });

    test("should find session by token", async () => {
      const user = factories.user();
      await db.insert(schema.user).values(user);

      const session = factories.session(user.id);
      await db.insert(schema.session).values(session);

      const result = await db
        .select()
        .from(schema.session)
        .where(eq(schema.session.token, session.token))
        .limit(1);

      expect(result[0]?.id).toBe(session.id);
      expect(result[0]?.userId).toBe(user.id);
    });

    test("should find all sessions for a user", async () => {
      const user = factories.user();
      await db.insert(schema.user).values(user);

      const session1 = factories.session(user.id);
      const session2 = factories.session(user.id);
      const session3 = factories.session(user.id);

      await db.insert(schema.session).values([session1, session2, session3]);

      const result = await db
        .select()
        .from(schema.session)
        .where(eq(schema.session.userId, user.id));

      expect(result.length).toBe(3);
    });
  });

  describe("Account Table", () => {
    test("should create and retrieve an account", async () => {
      const user = factories.user();
      await db.insert(schema.user).values(user);

      const account = {
        id: `account_${Date.now()}`,
        userId: user.id,
        accountId: "123456",
        providerId: "google",
        accessToken: "access_token_123",
        refreshToken: "refresh_token_123",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as schema.NewAccount;

      const result = await db.insert(schema.account).values(account).returning();

      expect(result[0]).toBeDefined();
      expect(result[0]?.providerId).toBe("google");
      expect(result[0]?.accessToken).toBe("access_token_123");
    });

    test("should enforce foreign key constraint on user_id", async () => {
      const account = {
        id: `account_${Date.now()}`,
        userId: "non-existent-user",
        accountId: "123456",
        providerId: "google",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as schema.NewAccount;

      try {
        await db.insert(schema.account).values(account);
        throw new Error("Should have thrown foreign key constraint error");
      } catch (error: any) {
        expect(error.message).toContain("FOREIGN KEY");
      }
    });

    test("should cascade delete accounts when user is deleted", async () => {
      const user = factories.user();
      await db.insert(schema.user).values(user);

      const account1 = {
        id: `account_1_${Date.now()}`,
        userId: user.id,
        accountId: "google_123",
        providerId: "google",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as schema.NewAccount;

      const account2 = {
        id: `account_2_${Date.now()}`,
        userId: user.id,
        accountId: "github_456",
        providerId: "github",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as schema.NewAccount;

      await db.insert(schema.account).values([account1, account2]);

      await db.delete(schema.user).where(eq(schema.user.id, user.id));

      const accounts = await db
        .select()
        .from(schema.account)
        .where(eq(schema.account.userId, user.id));

      expect(accounts.length).toBe(0);
    });
  });

  describe("Verification Table", () => {
    test("should create and retrieve a verification record", async () => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour

      const verification = {
        id: `verification_${Date.now()}`,
        identifier: "email",
        value: "test@example.com",
        expiresAt,
        createdAt: now,
        updatedAt: now,
      } as schema.NewVerification;

      const result = await db
        .insert(schema.verification)
        .values(verification)
        .returning();

      expect(result[0]).toBeDefined();
      expect(result[0]?.identifier).toBe("email");
      expect(result[0]?.value).toBe("test@example.com");
    });

    test("should find verification by identifier and value", async () => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 60 * 60 * 1000);

      const verification = {
        id: `verification_${Date.now()}`,
        identifier: "email",
        value: "unique@example.com",
        expiresAt,
        createdAt: now,
        updatedAt: now,
      } as schema.NewVerification;

      await db.insert(schema.verification).values(verification);

      const result = await db
        .select()
        .from(schema.verification)
        .where(
          eq(schema.verification.identifier, "email")
        );

      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe("Todo Table", () => {
    test("should create and retrieve a todo", async () => {
      const user = factories.user();
      await db.insert(schema.user).values(user);

      const newTodo = factories.todo(user.id);

      const result = await db.insert(schema.todo).values(newTodo).returning();

      expect(result[0]).toBeDefined();
      expect(result[0]?.userId).toBe(user.id);
      expect(result[0]?.title).toBe("Test Todo");
      expect(result[0]?.completed).toBe(false);
    });

    test("should enforce foreign key constraint on user_id", async () => {
      const todo = factories.todo("non-existent-user");

      try {
        await db.insert(schema.todo).values(todo);
        throw new Error("Should have thrown foreign key constraint error");
      } catch (error: any) {
        expect(error.message).toContain("FOREIGN KEY");
      }
    });

    test("should cascade delete todos when user is deleted", async () => {
      const user = factories.user();
      await db.insert(schema.user).values(user);

      const todo1 = factories.todo(user.id);
      const todo2 = factories.todo(user.id);
      await db.insert(schema.todo).values([todo1, todo2]);

      await db.delete(schema.user).where(eq(schema.user.id, user.id));

      const todos = await db
        .select()
        .from(schema.todo)
        .where(eq(schema.todo.userId, user.id));

      expect(todos.length).toBe(0);
    });

    test("should update todo", async () => {
      const user = factories.user();
      await db.insert(schema.user).values(user);

      const todo = factories.todo(user.id);
      await db.insert(schema.todo).values(todo);

      const result = await db
        .update(schema.todo)
        .set({
          title: "Updated Title",
          completed: true,
          updatedAt: new Date(),
        })
        .where(eq(schema.todo.id, todo.id))
        .returning();

      expect(result[0]?.title).toBe("Updated Title");
      expect(result[0]?.completed).toBe(true);
    });

    test("should filter todos by completed status", async () => {
      const user = factories.user();
      await db.insert(schema.user).values(user);

      const completedTodo = factories.todo(user.id, {
        completed: true,
        title: "Completed",
      });
      const pendingTodo1 = factories.todo(user.id, {
        completed: false,
        title: "Pending 1",
      });
      const pendingTodo2 = factories.todo(user.id, {
        completed: false,
        title: "Pending 2",
      });

      await db.insert(schema.todo).values([completedTodo, pendingTodo1, pendingTodo2]);

      const pending = await db
        .select()
        .from(schema.todo)
        .where(eq(schema.todo.completed, false));

      const completed = await db
        .select()
        .from(schema.todo)
        .where(eq(schema.todo.completed, true));

      expect(pending.length).toBe(2);
      expect(completed.length).toBe(1);
    });

    test("should order todos by createdAt", async () => {
      const user = factories.user();
      await db.insert(schema.user).values(user);

      const todo1 = factories.todo(user.id, {
        createdAt: new Date("2024-01-01"),
        title: "First",
      });
      const todo2 = factories.todo(user.id, {
        createdAt: new Date("2024-01-02"),
        title: "Second",
      });
      const todo3 = factories.todo(user.id, {
        createdAt: new Date("2024-01-03"),
        title: "Third",
      });

      await db.insert(schema.todo).values([todo1, todo2, todo3]);

      const result = await db
        .select()
        .from(schema.todo)
        .where(eq(schema.todo.userId, user.id))
        .orderBy(schema.todo.createdAt);

      expect(result[0]?.title).toBe("First");
      expect(result[1]?.title).toBe("Second");
      expect(result[2]?.title).toBe("Third");
    });
  });

  describe("Complex Queries", () => {
    test("should get user with all their todos", async () => {
      const user = factories.user();
      await db.insert(schema.user).values(user);

      const todos = [
        factories.todo(user.id, { title: "Todo 1" }),
        factories.todo(user.id, { title: "Todo 2" }),
        factories.todo(user.id, { title: "Todo 3" }),
      ];

      await db.insert(schema.todo).values(todos);

      const userResult = await db
        .select()
        .from(schema.user)
        .where(eq(schema.user.id, user.id))
        .limit(1);

      const todosResult = await db
        .select()
        .from(schema.todo)
        .where(eq(schema.todo.userId, user.id));

      expect(userResult[0]?.id).toBe(user.id);
      expect(todosResult.length).toBe(3);
    });

    test("should get user with active sessions", async () => {
      const user = factories.user();
      await db.insert(schema.user).values(user);

      const now = new Date();
      const activeSession = factories.session(user.id, {
        expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      });
      const expiredSession = factories.session(user.id, {
        expiresAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
      });

      await db.insert(schema.session).values([activeSession, expiredSession]);

      const sessions = await db
        .select()
        .from(schema.session)
        .where(
          eq(schema.session.userId, user.id)
        );

      const activeSessions = sessions.filter(
        (s) => new Date(s.expiresAt!) > now
      );

      expect(sessions.length).toBe(2);
      expect(activeSessions.length).toBe(1);
    });
  });
});
