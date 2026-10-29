import { z } from "zod";
import { ISSUE_CATEGORIES, REPORT_STATUSES } from "../constants.js";
import { CoordinatesSchema } from "./geo.js";

export const IssueCategorySchema = z.enum(ISSUE_CATEGORIES);
export const ReportStatusSchema = z.enum(REPORT_STATUSES);

export const CreateReportSchema = z.object({
  category: IssueCategorySchema,
  description: z.string().min(10).max(5000),
  coordinates: CoordinatesSchema,
  placeId: z.string().uuid().optional(),
  proposedChanges: z.record(z.unknown()).optional(),
  guestEmail: z.string().email().optional(),
});

export type CreateReport = z.infer<typeof CreateReportSchema>;

export const CorrectionReportSchema = z.object({
  id: z.string().uuid(),
  trackingId: z.string(),
  category: IssueCategorySchema,
  description: z.string(),
  coordinates: CoordinatesSchema,
  placeId: z.string().uuid().nullable().optional(),
  proposedChanges: z.record(z.unknown()).nullable().optional(),
  status: ReportStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  submitterId: z.string().uuid().nullable().optional(),
});

export type CorrectionReport = z.infer<typeof CorrectionReportSchema>;

export const ReportConfirmationSchema = z.object({
  stance: z.enum(["confirm", "dispute", "flag_abuse"]),
  observation: z.string().max(2000).optional(),
});

export const ModerationReviewSchema = z.object({
  action: z.enum([
    "approve",
    "reject",
    "request_more_info",
    "apply",
    "revert",
  ]),
  notes: z.string().max(5000).optional(),
});
