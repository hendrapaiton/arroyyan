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

// Login schema
export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

// Customer schemas
export const createCustomerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(1, "Phone is required"),
  address: z.string().optional(),
  notes: z.string().optional(),
});

export const updateCustomerSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
});

// Pet schemas
export const createPetSchema = z.object({
  customerId: z.string().uuid("Invalid customer ID"),
  name: z.string().min(1, "Pet name is required"),
  species: z.string().min(1, "Species is required"),
  breed: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.enum(["male", "female"]).optional(),
  weight: z.number().positive().optional(),
  color: z.string().optional(),
  medicalNotes: z.string().optional(),
});

export const updatePetSchema = z.object({
  name: z.string().min(1).optional(),
  species: z.string().min(1).optional(),
  breed: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.enum(["male", "female"]).optional(),
  weight: z.number().positive().optional(),
  color: z.string().optional(),
  medicalNotes: z.string().optional(),
  isActive: z.boolean().optional(),
});

// Service schemas
export const createServiceSchema = z.object({
  name: z.string().min(1, "Service name is required"),
  description: z.string().optional(),
  price: z.number().positive("Price must be positive"),
  duration: z.number().int().positive().optional(),
  category: z.string().min(1, "Category is required"),
});

export const updateServiceSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  price: z.number().positive().optional(),
  duration: z.number().int().positive().optional(),
  category: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});

// Product schemas
export const createProductSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  description: z.string().optional(),
  sku: z.string().min(1, "SKU is required"),
  category: z.string().min(1, "Category is required"),
  price: z.number().positive("Price must be positive"),
  cost: z.number().nonnegative().optional(),
  stock: z.number().int().nonnegative().default(0),
  minStock: z.number().int().nonnegative().default(5),
  unit: z.string().optional(),
});

export const updateProductSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  sku: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  price: z.number().positive().optional(),
  cost: z.number().nonnegative().optional(),
  stock: z.number().int().nonnegative().optional(),
  minStock: z.number().int().nonnegative().optional(),
  unit: z.string().optional(),
  isActive: z.boolean().optional(),
});

// Appointment schemas
export const createAppointmentSchema = z.object({
  petId: z.string().uuid("Invalid pet ID"),
  serviceId: z.string().uuid("Invalid service ID"),
  appointmentDate: z.string(),
  notes: z.string().optional(),
});

export const updateAppointmentSchema = z.object({
  petId: z.string().uuid().optional(),
  serviceId: z.string().uuid().optional(),
  appointmentDate: z.string().optional(),
  status: z.enum(["pending", "confirmed", "completed", "cancelled"]).optional(),
  notes: z.string().optional(),
  totalPrice: z.number().nonnegative().optional(),
});

// Sale schemas
export const createSaleSchema = z.object({
  customerId: z.string().uuid().optional(),
  items: z.array(z.object({
    productId: z.string().uuid("Invalid product ID"),
    quantity: z.number().int().positive("Quantity must be positive"),
  })).min(1, "At least one item is required"),
  paymentMethod: z.enum(["cash", "card", "transfer"]),
  discount: z.number().nonnegative().default(0),
  notes: z.string().optional(),
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
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type CreatePetInput = z.infer<typeof createPetSchema>;
export type UpdatePetInput = z.infer<typeof updatePetSchema>;
export type CreateServiceInput = z.infer<typeof createServiceSchema>;
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>;
export type CreateSaleInput = z.infer<typeof createSaleSchema>;
