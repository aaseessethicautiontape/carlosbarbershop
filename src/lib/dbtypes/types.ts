import type { Database } from "./database.types";

export type Tables = Database["public"]["Tables"];
export type Row<T extends keyof Tables> = Tables[T]["Row"];
export type AppRole = Database["public"]["Enums"]["app_role"];
export type BookingStatus = Database["public"]["Enums"]["booking_status"];
export type TemplateKey = "confirmation" | "reminder_24h" | "reminder_2h" | "walkin_next" | "come_back";
