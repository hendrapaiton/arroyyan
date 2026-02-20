import { describe, test, expect, beforeEach } from "bun:test";
import { eq } from "drizzle-orm";
import { createTestDatabase, factories } from "./utils";
import * as schema from "../src/db/schema";
import { nanoid } from "../src/lib/nanoid";

describe("Authentication Integration Tests", () => {
  let db: ReturnType<typeof createTestDatabase>["db"];
  let sqlite: ReturnType<typeof createTestDatabase>["sqlite"];

  beforeEach(() => {
    const testDb = createTestDatabase();
    db = testDb.db;
    sqlite = testDb.sqlite;
  });

  describe("User Registration Flow", () => {
    test("should register a new user with hashed password", async () => {
      const userId = nanoid();
      const now = new Date();

      // Simulate registration with password hash
      const user = {
        id: userId,
        name: "New User",
        email: "newuser@example.com",
        emailVerified: false,
        createdAt: now,
        updatedAt: now,
      } as schema.NewUser;

      const account = {
        id: nanoid(),
        userId: userId,
        accountId: "email",
        providerId: "credential",
        password: "$2a$10$hashedpassword123", // Simulated hash
        createdAt: now,
        updatedAt: now,
      } as schema.NewAccount;

      // Insert user and account
      const [userResult] = await db.insert(schema.user).values(user).returning();
      await db.insert(schema.account).values(account);

      expect(userResult).toBeDefined();
      expect(userResult?.email).toBe("newuser@example.com");

      // Verify account was created
      const accountResult = await db
        .select()
        .from(schema.account)
        .where(eq(schema.account.userId, userId))
        .limit(1);

      expect(accountResult[0]).toBeDefined();
      expect(accountResult[0]?.providerId).toBe("credential");
      expect(accountResult[0]?.password).toBeDefined();
    });

    test("should not allow duplicate email registration", async () => {
      const user1 = factories.user({ email: "duplicate@example.com" });
      const user2 = factories.user({ email: "duplicate@example.com" });

      await db.insert(schema.user).values(user1);

      try {
        await db.insert(schema.user).values(user2);
        throw new Error("Should have thrown unique constraint error");
      } catch (error: any) {
        expect(error.message).toContain("UNIQUE");
      }
    });
  });

  describe("User Login Flow", () => {
    test("should create session on successful login", async () => {
      const user = factories.user();
      await db.insert(schema.user).values(user);

      // Create account with password
      const account = {
        id: nanoid(),
        userId: user.id,
        accountId: "email",
        providerId: "credential",
        password: "$2a$10$hashedpassword123",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as schema.NewAccount;
      await db.insert(schema.account).values(account);

      // Simulate login - create session
      const session = factories.session(user.id);
      const [sessionResult] = await db
        .insert(schema.session)
        .values(session)
        .returning();

      expect(sessionResult).toBeDefined();
      expect(sessionResult?.userId).toBe(user.id);
      expect(sessionResult?.token).toBe(session.token);
    });

    test("should retrieve valid session by token", async () => {
      const user = factories.user();
      await db.insert(schema.user).values(user);

      const validToken = `token_${nanoid()}`;
      const session = factories.session(user.id, { token: validToken });
      await db.insert(schema.session).values(session);

      const result = await db
        .select()
        .from(schema.session)
        .where(eq(schema.session.token, validToken))
        .limit(1);

      expect(result[0]).toBeDefined();
      expect(result[0]?.userId).toBe(user.id);
    });

    test("should identify expired session", async () => {
      const user = factories.user();
      await db.insert(schema.user).values(user);

      const now = new Date();
      const expiredSession = factories.session(user.id, {
        expiresAt: new Date(now.getTime() - 24 * 60 * 60 * 1000), // 1 day ago
      });
      const validSession = factories.session(user.id, {
        expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      });

      await db.insert(schema.session).values([expiredSession, validSession]);

      const allSessions = await db
        .select()
        .from(schema.session)
        .where(eq(schema.session.userId, user.id));

      const expiredCount = allSessions.filter(
        (s) => new Date(s.expiresAt!) < now
      ).length;
      const validCount = allSessions.filter(
        (s) => new Date(s.expiresAt!) >= now
      ).length;

      expect(expiredCount).toBe(1);
      expect(validCount).toBe(1);
    });
  });

  describe("Session Management", () => {
    test("should delete session on logout", async () => {
      const user = factories.user();
      await db.insert(schema.user).values(user);

      const session = factories.session(user.id);
      await db.insert(schema.session).values(session);

      // Verify session exists
      const beforeDelete = await db
        .select()
        .from(schema.session)
        .where(eq(schema.session.token, session.token));
      expect(beforeDelete.length).toBe(1);

      // Delete session (logout)
      await db
        .delete(schema.session)
        .where(eq(schema.session.token, session.token));

      // Verify session is deleted
      const afterDelete = await db
        .select()
        .from(schema.session)
        .where(eq(schema.session.token, session.token));
      expect(afterDelete.length).toBe(0);
    });

    test("should delete all sessions when user deletes account", async () => {
      const user = factories.user();
      await db.insert(schema.user).values(user);

      const sessions = [
        factories.session(user.id),
        factories.session(user.id),
        factories.session(user.id),
      ];
      await db.insert(schema.session).values(sessions);

      // Delete user (cascade should delete sessions)
      await db.delete(schema.user).where(eq(schema.user.id, user.id));

      const remainingSessions = await db
        .select()
        .from(schema.session)
        .where(eq(schema.session.userId, user.id));

      expect(remainingSessions.length).toBe(0);
    });

    test("should allow multiple concurrent sessions", async () => {
      const user = factories.user();
      await db.insert(schema.user).values(user);

      const sessions = [
        factories.session(user.id, {
          token: "token_device_1",
          userAgent: "Chrome on Windows",
          ipAddress: "192.168.1.1",
        }),
        factories.session(user.id, {
          token: "token_device_2",
          userAgent: "Safari on iPhone",
          ipAddress: "192.168.1.2",
        }),
        factories.session(user.id, {
          token: "token_device_3",
          userAgent: "Firefox on Linux",
          ipAddress: "192.168.1.3",
        }),
      ];

      await db.insert(schema.session).values(sessions);

      const userSessions = await db
        .select()
        .from(schema.session)
        .where(eq(schema.session.userId, user.id));

      expect(userSessions.length).toBe(3);
    });
  });

  describe("Email Verification Flow", () => {
    test("should create verification record for email", async () => {
      const user = factories.user();
      await db.insert(schema.user).values(user);

      const now = new Date();
      const verificationCode = nanoid();
      const verification = {
        id: nanoid(),
        identifier: "email",
        value: verificationCode,
        expiresAt: new Date(now.getTime() + 60 * 60 * 1000), // 1 hour
        createdAt: now,
        updatedAt: now,
      } as schema.NewVerification;

      await db.insert(schema.verification).values(verification);

      const result = await db
        .select()
        .from(schema.verification)
        .where(eq(schema.verification.value, verificationCode))
        .limit(1);

      expect(result[0]).toBeDefined();
      expect(result[0]?.identifier).toBe("email");
    });

    test("should mark email as verified", async () => {
      const user = factories.user({ emailVerified: false });
      await db.insert(schema.user).values(user);

      // Simulate verification
      const result = await db
        .update(schema.user)
        .set({ emailVerified: true, updatedAt: new Date() })
        .where(eq(schema.user.id, user.id))
        .returning();

      expect(result[0]?.emailVerified).toBe(true);
    });

    test("should clean up expired verification codes", async () => {
      const now = new Date();
      const expiredVerification = {
        id: nanoid(),
        identifier: "email",
        value: "expired_code",
        expiresAt: new Date(now.getTime() - 60 * 60 * 1000), // 1 hour ago
        createdAt: now,
        updatedAt: now,
      } as schema.NewVerification;

      const validVerification = {
        id: nanoid(),
        identifier: "email",
        value: "valid_code",
        expiresAt: new Date(now.getTime() + 60 * 60 * 1000), // 1 hour from now
        createdAt: now,
        updatedAt: now,
      } as schema.NewVerification;

      await db.insert(schema.verification).values([
        expiredVerification,
        validVerification,
      ]);

      // Delete expired verifications
      await db
        .delete(schema.verification)
        .where(eq(schema.verification.expiresAt, expiredVerification.expiresAt));

      const remaining = await db.select().from(schema.verification);
      expect(remaining.length).toBe(1);
      expect(remaining[0]?.value).toBe("valid_code");
    });
  });

  describe("OAuth Account Linking", () => {
    test("should link OAuth account to existing user", async () => {
      const user = factories.user();
      await db.insert(schema.user).values(user);

      const googleAccount = {
        id: nanoid(),
        userId: user.id,
        accountId: "google_123456",
        providerId: "google",
        accessToken: "google_access_token",
        refreshToken: "google_refresh_token",
        scope: "email profile",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as schema.NewAccount;

      await db.insert(schema.account).values(googleAccount);

      const result = await db
        .select()
        .from(schema.account)
        .where(eq(schema.account.userId, user.id))
        .limit(1);

      expect(result[0]).toBeDefined();
      expect(result[0]?.providerId).toBe("google");
      expect(result[0]?.accountId).toBe("google_123456");
    });

    test("should allow multiple OAuth providers for same user", async () => {
      const user = factories.user();
      await db.insert(schema.user).values(user);

      const accounts = [
        {
          id: nanoid(),
          userId: user.id,
          accountId: "google_123",
          providerId: "google",
          createdAt: new Date(),
          updatedAt: new Date(),
        } as schema.NewAccount,
        {
          id: nanoid(),
          userId: user.id,
          accountId: "github_456",
          providerId: "github",
          createdAt: new Date(),
          updatedAt: new Date(),
        } as schema.NewAccount,
      ];

      await db.insert(schema.account).values(accounts);

      const userAccounts = await db
        .select()
        .from(schema.account)
        .where(eq(schema.account.userId, user.id));

      expect(userAccounts.length).toBe(2);
      expect(userAccounts.map((a) => a.providerId)).toEqual(
        expect.arrayContaining(["google", "github"])
      );
    });
  });
});
