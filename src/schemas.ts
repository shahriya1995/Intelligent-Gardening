import { z } from "zod";

export const gardenSchema = z.object({
  name: z.string().min(1).max(120),
  location: z.string().max(200).default(""),
  hardiness_zone: z.string().max(20).default(""),
});

export const taskSchema = z.object({
  garden_id: z.number().int().positive(),
  title: z.string().min(1).max(200),
  due_date: z.string().date(),
  plant: z.string().max(120).default(""),
  notes: z.string().max(2000).default(""),
});

export const plantSchema = z.object({
  garden_id: z.number().int().positive(),
  name: z.string().min(1).max(120),
  variety: z.string().max(120).default(""),
  quantity: z.number().int().positive().max(100000).default(1),
  planted_date: z.union([z.string().date(), z.literal("")]).default(""),
  notes: z.string().max(2000).default(""),
});

export const documentSchema = z.object({
  title: z.string().min(1).max(300),
  content: z.string().min(20),
  source_url: z.string().max(1000).default(""),
  publisher: z.string().max(200).default(""),
  region: z.string().max(120).default(""),
  tags: z.array(z.string()).default([]),
});

export const searchSchema = z.object({
  query: z.string().min(2).max(500),
  region: z.string().max(120).default(""),
  limit: z.number().int().min(1).max(20).default(5),
});
