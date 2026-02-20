import { describe, test, expect, beforeEach } from "bun:test";
import { eq, asc, desc } from "drizzle-orm";
import { createTestDatabase, factories } from "./utils";
import * as schema from "../src/db/schema";
import { nanoid } from "../src/lib/nanoid";

describe("Todo CRUD Integration Tests", () => {
  let db: ReturnType<typeof createTestDatabase>["db"];
  let sqlite: ReturnType<typeof createTestDatabase>["sqlite"];

  beforeEach(() => {
    const testDb = createTestDatabase();
    db = testDb.db;
    sqlite = testDb.sqlite;
  });

  describe("Create Todo", () => {
    test("should create a todo for user", async () => {
      const user = factories.user();
      await db.insert(schema.user).values(user);

      const todo = factories.todo(user.id);
      const [result] = await db.insert(schema.todo).values(todo).returning();

      expect(result).toBeDefined();
      expect(result?.title).toBe("Test Todo");
      expect(result?.userId).toBe(user.id);
      expect(result?.completed).toBe(false);
    });

    test("should create todo without description", async () => {
      const user = factories.user();
      await db.insert(schema.user).values(user);

      const todo = factories.todo(user.id, { description: null });
      const [result] = await db.insert(schema.todo).values(todo).returning();

      expect(result).toBeDefined();
      expect(result?.description).toBeNull();
    });

    test("should create multiple todos at once", async () => {
      const user = factories.user();
      await db.insert(schema.user).values(user);

      const todos = [
        factories.todo(user.id, { title: "Task 1" }),
        factories.todo(user.id, { title: "Task 2" }),
        factories.todo(user.id, { title: "Task 3" }),
      ];

      const results = await db.insert(schema.todo).values(todos).returning();

      expect(results.length).toBe(3);
      expect(results.map((t) => t?.title)).toEqual(
        expect.arrayContaining(["Task 1", "Task 2", "Task 3"])
      );
    });
  });

  describe("Read Todos", () => {
    test("should get all todos for a user", async () => {
      const user = factories.user();
      await db.insert(schema.user).values(user);

      const todos = [
        factories.todo(user.id, { title: "My Todo 1" }),
        factories.todo(user.id, { title: "My Todo 2" }),
      ];
      await db.insert(schema.todo).values(todos);

      // Create todos for another user (should not be returned)
      const otherUser = factories.user();
      await db.insert(schema.user).values(otherUser);
      await db
        .insert(schema.todo)
        .values(factories.todo(otherUser.id, { title: "Other Todo" }));

      const userTodos = await db
        .select()
        .from(schema.todo)
        .where(eq(schema.todo.userId, user.id));

      expect(userTodos.length).toBe(2);
      expect(userTodos.every((t) => t.userId === user.id)).toBe(true);
    });

    test("should get single todo by id", async () => {
      const user = factories.user();
      await db.insert(schema.user).values(user);

      const todo = factories.todo(user.id, { title: "Specific Todo" });
      await db.insert(schema.todo).values(todo);

      const result = await db
        .select()
        .from(schema.todo)
        .where(eq(schema.todo.id, todo.id))
        .limit(1);

      expect(result[0]).toBeDefined();
      expect(result[0]?.title).toBe("Specific Todo");
    });

    test("should return empty array when user has no todos", async () => {
      const user = factories.user();
      await db.insert(schema.user).values(user);

      const todos = await db
        .select()
        .from(schema.todo)
        .where(eq(schema.todo.userId, user.id));

      expect(todos.length).toBe(0);
    });
  });

  describe("Update Todo", () => {
    test("should update todo title", async () => {
      const user = factories.user();
      await db.insert(schema.user).values(user);

      const todo = factories.todo(user.id);
      await db.insert(schema.todo).values(todo);

      const [result] = await db
        .update(schema.todo)
        .set({ title: "Updated Title", updatedAt: new Date() })
        .where(eq(schema.todo.id, todo.id))
        .returning();

      expect(result?.title).toBe("Updated Title");
    });

    test("should toggle todo completed status", async () => {
      const user = factories.user();
      await db.insert(schema.user).values(user);

      const todo = factories.todo(user.id, { completed: false });
      await db.insert(schema.todo).values(todo);

      const [result] = await db
        .update(schema.todo)
        .set({ completed: true, updatedAt: new Date() })
        .where(eq(schema.todo.id, todo.id))
        .returning();

      expect(result?.completed).toBe(true);
    });

    test("should update todo description", async () => {
      const user = factories.user();
      await db.insert(schema.user).values(user);

      const todo = factories.todo(user.id, { description: "Old description" });
      await db.insert(schema.todo).values(todo);

      const [result] = await db
        .update(schema.todo)
        .set({
          description: "New description",
          updatedAt: new Date(),
        })
        .where(eq(schema.todo.id, todo.id))
        .returning();

      expect(result?.description).toBe("New description");
    });

    test("should update updatedAt timestamp", async () => {
      const user = factories.user();
      await db.insert(schema.user).values(user);

      const todo = factories.todo(user.id);
      await db.insert(schema.todo).values(todo);

      const beforeUpdate = await db
        .select()
        .from(schema.todo)
        .where(eq(schema.todo.id, todo.id))
        .limit(1);

      const oldUpdatedAt = beforeUpdate[0]?.updatedAt?.getTime() || 0;

      // Wait to ensure timestamp difference (SQLite has second precision)
      await new Promise((resolve) => setTimeout(resolve, 1100));

      const newTime = new Date();
      const [result] = await db
        .update(schema.todo)
        .set({ title: "Updated", updatedAt: newTime })
        .where(eq(schema.todo.id, todo.id))
        .returning();

      expect(result?.updatedAt?.getTime()).toBeGreaterThan(oldUpdatedAt);
    });
  });

  describe("Delete Todo", () => {
    test("should delete a todo", async () => {
      const user = factories.user();
      await db.insert(schema.user).values(user);

      const todo = factories.todo(user.id);
      await db.insert(schema.todo).values(todo);

      await db.delete(schema.todo).where(eq(schema.todo.id, todo.id));

      const result = await db
        .select()
        .from(schema.todo)
        .where(eq(schema.todo.id, todo.id));

      expect(result.length).toBe(0);
    });

    test("should not delete other user's todo", async () => {
      const user1 = factories.user();
      const user2 = factories.user();
      await db.insert(schema.user).values([user1, user2]);

      const todo = factories.todo(user1.id);
      await db.insert(schema.todo).values(todo);

      // Try to delete using user2's id (should not match)
      await db
        .delete(schema.todo)
        .where(eq(schema.todo.userId, user2.id));

      const remaining = await db
        .select()
        .from(schema.todo)
        .where(eq(schema.todo.id, todo.id));

      expect(remaining.length).toBe(1);
    });

    test("should delete all todos when user is deleted", async () => {
      const user = factories.user();
      await db.insert(schema.user).values(user);

      const todos = [
        factories.todo(user.id),
        factories.todo(user.id),
        factories.todo(user.id),
      ];
      await db.insert(schema.todo).values(todos);

      await db.delete(schema.user).where(eq(schema.user.id, user.id));

      const remainingTodos = await db
        .select()
        .from(schema.todo)
        .where(eq(schema.todo.userId, user.id));

      expect(remainingTodos.length).toBe(0);
    });
  });

  describe("Query and Filter Todos", () => {
    test("should filter by completed status", async () => {
      const user = factories.user();
      await db.insert(schema.user).values(user);

      const todos = [
        factories.todo(user.id, { title: "Done 1", completed: true }),
        factories.todo(user.id, { title: "Done 2", completed: true }),
        factories.todo(user.id, { title: "Pending 1", completed: false }),
        factories.todo(user.id, { title: "Pending 2", completed: false }),
        factories.todo(user.id, { title: "Pending 3", completed: false }),
      ];
      await db.insert(schema.todo).values(todos);

      const completed = await db
        .select()
        .from(schema.todo)
        .where(eq(schema.todo.completed, true));

      const pending = await db
        .select()
        .from(schema.todo)
        .where(eq(schema.todo.completed, false));

      expect(completed.length).toBe(2);
      expect(pending.length).toBe(3);
    });

    test("should order by createdAt ascending", async () => {
      const user = factories.user();
      await db.insert(schema.user).values(user);

      const todos = [
        factories.todo(user.id, {
          title: "Third",
          createdAt: new Date("2024-01-03"),
        }),
        factories.todo(user.id, {
          title: "First",
          createdAt: new Date("2024-01-01"),
        }),
        factories.todo(user.id, {
          title: "Second",
          createdAt: new Date("2024-01-02"),
        }),
      ];
      await db.insert(schema.todo).values(todos);

      const result = await db
        .select()
        .from(schema.todo)
        .where(eq(schema.todo.userId, user.id))
        .orderBy(asc(schema.todo.createdAt));

      expect(result.map((t) => t.title)).toEqual([
        "First",
        "Second",
        "Third",
      ]);
    });

    test("should order by createdAt descending", async () => {
      const user = factories.user();
      await db.insert(schema.user).values(user);

      const todos = [
        factories.todo(user.id, {
          title: "First",
          createdAt: new Date("2024-01-01"),
        }),
        factories.todo(user.id, {
          title: "Second",
          createdAt: new Date("2024-01-02"),
        }),
        factories.todo(user.id, {
          title: "Third",
          createdAt: new Date("2024-01-03"),
        }),
      ];
      await db.insert(schema.todo).values(todos);

      const result = await db
        .select()
        .from(schema.todo)
        .where(eq(schema.todo.userId, user.id))
        .orderBy(desc(schema.todo.createdAt));

      expect(result.map((t) => t.title)).toEqual([
        "Third",
        "Second",
        "First",
      ]);
    });

    test("should search todos by title pattern", async () => {
      const user = factories.user();
      await db.insert(schema.user).values(user);

      const todos = [
        factories.todo(user.id, { title: "Buy groceries" }),
        factories.todo(user.id, { title: "Walk the dog" }),
        factories.todo(user.id, { title: "Buy birthday gift" }),
        factories.todo(user.id, { title: "Call mom" }),
      ];
      await db.insert(schema.todo).values(todos);

      // Note: SQLite LIKE pattern
      const buyTodos = await db
        .select()
        .from(schema.todo)
        .where(eq(schema.todo.userId, user.id));

      const filtered = buyTodos.filter((t) =>
        t.title.toLowerCase().includes("buy")
      );

      expect(filtered.length).toBe(2);
    });
  });

  describe("Todo Statistics", () => {
    test("should count todos by status", async () => {
      const user = factories.user();
      await db.insert(schema.user).values(user);

      const todos = [
        factories.todo(user.id, { completed: true }),
        factories.todo(user.id, { completed: true }),
        factories.todo(user.id, { completed: true }),
        factories.todo(user.id, { completed: false }),
        factories.todo(user.id, { completed: false }),
      ];
      await db.insert(schema.todo).values(todos);

      const allTodos = await db
        .select()
        .from(schema.todo)
        .where(eq(schema.todo.userId, user.id));

      const completedCount = allTodos.filter((t) => t.completed).length;
      const pendingCount = allTodos.filter((t) => !t.completed).length;

      expect(completedCount).toBe(3);
      expect(pendingCount).toBe(2);
      expect(allTodos.length).toBe(5);
    });

    test("should calculate completion percentage", async () => {
      const user = factories.user();
      await db.insert(schema.user).values(user);

      const todos = [
        factories.todo(user.id, { completed: true }),
        factories.todo(user.id, { completed: true }),
        factories.todo(user.id, { completed: true }),
        factories.todo(user.id, { completed: true }),
        factories.todo(user.id, { completed: false }),
      ];
      await db.insert(schema.todo).values(todos);

      const allTodos = await db
        .select()
        .from(schema.todo)
        .where(eq(schema.todo.userId, user.id));

      const completedCount = allTodos.filter((t) => t.completed).length;
      const percentage = (completedCount / allTodos.length) * 100;

      expect(percentage).toBe(80);
    });
  });

  describe("Multi-User Isolation", () => {
    test("should isolate todos between users", async () => {
      const user1 = factories.user();
      const user2 = factories.user();
      await db.insert(schema.user).values([user1, user2]);

      const user1Todos = [
        factories.todo(user1.id, { title: "User 1 Todo 1" }),
        factories.todo(user1.id, { title: "User 1 Todo 2" }),
      ];
      const user2Todos = [
        factories.todo(user2.id, { title: "User 2 Todo 1" }),
        factories.todo(user2.id, { title: "User 2 Todo 2" }),
        factories.todo(user2.id, { title: "User 2 Todo 3" }),
      ];

      await db.insert(schema.todo).values([...user1Todos, ...user2Todos]);

      const user1Result = await db
        .select()
        .from(schema.todo)
        .where(eq(schema.todo.userId, user1.id));

      const user2Result = await db
        .select()
        .from(schema.todo)
        .where(eq(schema.todo.userId, user2.id));

      expect(user1Result.length).toBe(2);
      expect(user2Result.length).toBe(3);
      expect(user1Result.every((t) => t.userId === user1.id)).toBe(true);
      expect(user2Result.every((t) => t.userId === user2.id)).toBe(true);
    });

    test("should not allow accessing another user's todo", async () => {
      const user1 = factories.user();
      const user2 = factories.user();
      await db.insert(schema.user).values([user1, user2]);

      const todo = factories.todo(user1.id, { title: "Private Todo" });
      await db.insert(schema.todo).values(todo);

      // Try to get todo using user2's id (should return empty)
      const result = await db
        .select()
        .from(schema.todo)
        .where(
          eq(schema.todo.id, todo.id) && eq(schema.todo.userId, user2.id)
        );

      expect(result.length).toBe(0);
    });
  });
});
