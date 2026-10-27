import { z } from "zod";

export const PRODUCTS = ["cuenta_ahorros", "cuenta_corriente", "tarjeta_credito"] as const;
export const ProductSchema = z.enum(PRODUCTS);
export type Product = z.infer<typeof ProductSchema>;

export const OnboardingRequestSchema = z.object({
  prospect_name: z.string().trim().min(3).max(120),
  // Ecuadorian cédula: exactly 10 digits.
  document_id: z.string().regex(/^\d{10}$/, "document_id must be 10 digits"),
  product: ProductSchema,
});
export type OnboardingRequest = z.infer<typeof OnboardingRequestSchema>;
