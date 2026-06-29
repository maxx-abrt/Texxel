/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as a2e_books from "../a2e_books.js";
import type * as a2e_budgets from "../a2e_budgets.js";
import type * as a2e_categories from "../a2e_categories.js";
import type * as a2e_clients from "../a2e_clients.js";
import type * as a2e_documents from "../a2e_documents.js";
import type * as a2e_expenses from "../a2e_expenses.js";
import type * as a2e_fiches from "../a2e_fiches.js";
import type * as a2e_grantReports from "../a2e_grantReports.js";
import type * as a2e_invoices from "../a2e_invoices.js";
import type * as activities from "../activities.js";
import type * as auth from "../auth.js";
import type * as flux_comments from "../flux_comments.js";
import type * as flux_databases from "../flux_databases.js";
import type * as flux_docTemplates from "../flux_docTemplates.js";
import type * as flux_documents from "../flux_documents.js";
import type * as flux_events from "../flux_events.js";
import type * as flux_files from "../flux_files.js";
import type * as flux_labels from "../flux_labels.js";
import type * as flux_presence from "../flux_presence.js";
import type * as flux_projects from "../flux_projects.js";
import type * as flux_tags from "../flux_tags.js";
import type * as flux_taskStatuses from "../flux_taskStatuses.js";
import type * as flux_tasks from "../flux_tasks.js";
import type * as flux_time from "../flux_time.js";
import type * as flux_userPrefs from "../flux_userPrefs.js";
import type * as global_search from "../global_search.js";
import type * as http from "../http.js";
import type * as invitations from "../invitations.js";
import type * as lib_auth from "../lib/auth.js";
import type * as notifications from "../notifications.js";
import type * as projects from "../projects.js";
import type * as users from "../users.js";
import type * as workspaces from "../workspaces.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  a2e_books: typeof a2e_books;
  a2e_budgets: typeof a2e_budgets;
  a2e_categories: typeof a2e_categories;
  a2e_clients: typeof a2e_clients;
  a2e_documents: typeof a2e_documents;
  a2e_expenses: typeof a2e_expenses;
  a2e_fiches: typeof a2e_fiches;
  a2e_grantReports: typeof a2e_grantReports;
  a2e_invoices: typeof a2e_invoices;
  activities: typeof activities;
  auth: typeof auth;
  flux_comments: typeof flux_comments;
  flux_databases: typeof flux_databases;
  flux_docTemplates: typeof flux_docTemplates;
  flux_documents: typeof flux_documents;
  flux_events: typeof flux_events;
  flux_files: typeof flux_files;
  flux_labels: typeof flux_labels;
  flux_presence: typeof flux_presence;
  flux_projects: typeof flux_projects;
  flux_tags: typeof flux_tags;
  flux_taskStatuses: typeof flux_taskStatuses;
  flux_tasks: typeof flux_tasks;
  flux_time: typeof flux_time;
  flux_userPrefs: typeof flux_userPrefs;
  global_search: typeof global_search;
  http: typeof http;
  invitations: typeof invitations;
  "lib/auth": typeof lib_auth;
  notifications: typeof notifications;
  projects: typeof projects;
  users: typeof users;
  workspaces: typeof workspaces;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
