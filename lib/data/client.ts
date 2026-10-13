"use client";
import * as actions from "@/app/actions";
import type { ActionResult } from "@/app/actions";
// Server-action transport failures happen before an ActionResult can reach the UI.
// Convert those failures too, so editors retain drafts and controls can stop loading.
function guard<A extends unknown[], T>(
  fn: (...args: A) => Promise<ActionResult<T>>,
) {
  return async (...args: A): Promise<ActionResult<T>> => {
    try {
      return await fn(...args);
    } catch {
      return {
        ok: false,
        error:
          "Connection lost. Your changes have not been saved. Please try again.",
        code: "NETWORK",
      };
    }
  };
}
export const getBootstrap = guard(actions.getBootstrap);
export const getLibrary = guard(actions.getLibrary);
export const getMedia = guard(actions.getMedia);
export const getStatistics = guard(actions.getStatistics);
export const getCalendar = guard(actions.getCalendar);
export const getCollections = guard(actions.getCollections);
export const getCollection = guard(actions.getCollection);
export const getNotifications = guard(actions.getNotifications);
export const getWorkspaceSnapshot = guard(actions.getWorkspaceSnapshot);
export const mutate = guard(actions.mutate);
export const createSpace = guard(actions.createSpace);
export const selectSpace = guard(actions.selectSpace);
export const createInvitation = guard(actions.createInvitation);
export const acceptInvitation = guard(actions.acceptInvitation);
export const listInvitations = guard(actions.listInvitations);
export const revokeInvitation = guard(actions.revokeInvitation);
export const updateProfile = guard(actions.updateProfile);
