import { z } from "zod";

/**
 * Common Zod schemas for request/response validation
 */

// User schemas
export const createUserSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(1, "Name is required"),
});

export const updateUserSchema = z.object({
  email: z.string().email("Invalid email address").optional(),
  name: z.string().min(1, "Name is required").optional(),
});

// Todo schemas
export const createTodoSchema = z.object({
  title: z.string().min(1, "Title is required").max(255, "Title must be less than 255 characters"),
  description: z.string().max(1000, "Description must be less than 1000 characters").optional(),
});

export const updateTodoSchema = z.object({
  title: z.string().min(1, "Title is required").max(255).optional(),
  description: z.string().max(1000).optional(),
  completed: z.boolean().optional(),
});

// Login schema
export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

// Response schemas
export const errorResponseSchema = z.object({
  error: z.string(),
  message: z.string(),
});

export const successResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  data: z.unknown().optional(),
});

// Type exports
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type CreateTodoInput = z.infer<typeof createTodoSchema>;
export type UpdateTodoInput = z.infer<typeof updateTodoSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
