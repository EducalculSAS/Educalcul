/**
 * Audit logging utility for tracking admin actions
 * Ensures all sensitive operations are logged for security and compliance
 */

import { supabaseAdmin } from "@/lib/supabaseClient";

export enum AuditAction {
  USER_CREATED = "USER_CREATED",
  USER_UPDATED = "USER_UPDATED",
  USER_DELETED = "USER_DELETED",
  USER_BANNED = "USER_BANNED",
  USER_UNBANNED = "USER_UNBANNED",
  ADMIN_MESSAGE = "ADMIN_MESSAGE",
  PASSWORD_RESET = "PASSWORD_RESET",
  SUBSCRIPTION_CHANGED = "SUBSCRIPTION_CHANGED",
  CONTENT_CREATED = "CONTENT_CREATED",
  CONTENT_UPDATED = "CONTENT_UPDATED",
  CONTENT_PUBLISHED = "CONTENT_PUBLISHED",
  CONTENT_DELETED = "CONTENT_DELETED",
  FORUM_POST_DELETED = "FORUM_POST_DELETED",
  FORUM_COMMENT_DELETED = "FORUM_COMMENT_DELETED",
  REPORT_DISMISSED = "REPORT_DISMISSED",
  EMAIL_TEMPLATE_UPDATED = "EMAIL_TEMPLATE_UPDATED",
  REFERRAL_CODE_CREATED = "REFERRAL_CODE_CREATED",
  TWO_FACTOR_TOGGLED_BY_ADMIN = "TWO_FACTOR_TOGGLED_BY_ADMIN",
  LOGIN_SUCCESS = "LOGIN_SUCCESS",
  LOGIN_FAILED = "LOGIN_FAILED",
  TWO_FACTOR_CODE_SENT = "TWO_FACTOR_CODE_SENT",
  TWO_FACTOR_VERIFIED = "TWO_FACTOR_VERIFIED",
  TWO_FACTOR_FAILED = "TWO_FACTOR_FAILED",
  ADMIN_IP_ALLOWLIST_ADDED = "ADMIN_IP_ALLOWLIST_ADDED",
  ADMIN_IP_ALLOWLIST_REMOVED = "ADMIN_IP_ALLOWLIST_REMOVED",
  IMPERSONATION_STARTED = "IMPERSONATION_STARTED",
  IMPERSONATION_ENDED = "IMPERSONATION_ENDED",
  ADMIN_EDIT_ATTEMPT = "ADMIN_EDIT_ATTEMPT",
}

export interface AuditLogEntry {
  action: AuditAction;
  adminId: number;
  targetUserId?: number;
  targetType?: string;
  targetId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Log an admin action to audit trail
 */
export async function auditLog(
  entry: AuditLogEntry,
  request?: Request
): Promise<{ success: boolean; error?: string }> {
  try {
    const ipAddress =
      request?.headers.get("x-forwarded-for") ||
      request?.headers.get("x-real-ip") ||
      "unknown";
    const userAgent = request?.headers.get("user-agent") || "unknown";

    // Create audit log entry
    const { error } = await supabaseAdmin.from("audit_logs").insert({
      action: entry.action,
      admin_id: entry.adminId,
      target_user_id: entry.targetUserId || null,
      target_type: entry.targetType || null,
      target_id: entry.targetId || null,
      details: entry.details || null,
      ip_address: ipAddress,
      user_agent: userAgent,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error("[auditLog] Database error:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error("[auditLog] Error:", err);
    return { success: false, error: "Failed to log audit entry" };
  }
}

/**
 * Get audit logs for a specific target
 */
export async function getAuditLogs(
  targetUserId?: number,
  limit: number = 100
): Promise<any[]> {
  try {
    let query = supabaseAdmin
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (targetUserId) {
      query = query.eq("target_user_id", targetUserId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[getAuditLogs] Database error:", error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error("[getAuditLogs] Error:", err);
    return [];
  }
}
