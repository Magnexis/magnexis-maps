import { z } from "zod";
import { USER_ROLES } from "../constants.js";

export const UserRoleSchema = z.enum(USER_ROLES);

export const RegisterSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(10).max(128),
  displayName: z.string().min(1).max(100),
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const DeleteAccountSchema = z
  .object({
    password: z.string().min(1).max(128),
    confirmation: z.literal("DELETE"),
  })
  .strict();

export type DeleteAccount = z.infer<typeof DeleteAccountSchema>;

export const UserPublicSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string(),
  roles: z.array(UserRoleSchema),
  emailVerified: z.boolean(),
  createdAt: z.string().datetime(),
});

export type UserPublic = z.infer<typeof UserPublicSchema>;

export const SavedPlaceSchema = z.object({
  id: z.string().uuid(),
  placeId: z.string().uuid().nullable().optional(),
  label: z.string().min(1).max(100),
  coordinates: z.object({
    lng: z.number(),
    lat: z.number(),
  }),
  notes: z.string().max(1000).optional(),
  createdAt: z.string().datetime(),
});

export const CreateSavedPlaceSchema = z.object({
  placeId: z.string().uuid().optional(),
  label: z.string().min(1).max(100),
  lng: z.number().min(-180).max(180),
  lat: z.number().min(-90).max(90),
  notes: z.string().max(1000).optional(),
});

export type CreateSavedPlace = z.infer<typeof CreateSavedPlaceSchema>;
