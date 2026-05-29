export type Platform = "x" | "linkedin" | "facebook" | "instagram" | "tiktok";

export const PLATFORMS: Platform[] = ["x", "linkedin", "facebook", "instagram", "tiktok"];

export const PLATFORM_LABELS: Record<Platform, string> = {
  x: "X",
  linkedin: "LinkedIn",
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
};

export const PLATFORM_COLORS: Record<Platform, string> = {
  x: "#000000",
  linkedin: "#0a66c2",
  facebook: "#1877f2",
  instagram: "#e1306c",
  tiktok: "#010101",
};

export interface AIUser {
  id: string;
  display_name: string;
  avatar_url: string | null;
  api_key_hash: string;
  created_at: string;
}

export interface Account {
  id: string;
  ai_user_id: string;
  platform: Platform;
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
  external_user_id: string;
  connected_at: string;
  token_status: "active" | "expired" | "revoked";
}

export type PostStatus =
  | "draft"
  | "scheduled"
  | "publishing"
  | "published"
  | "failed"
  | "cancelled";

export interface Post {
  id: string;
  ai_user_id: string;
  scheduled_for: string; // ISO
  status: PostStatus;
  created_at: string;
  updated_at: string;
}

export interface PostVariant {
  id: string;
  post_id: string;
  account_id: string;
  platform: Platform;
  body: string;
  media_paths: string[]; // local paths
  reply_to_external_id: string | null;
}

export interface PostAttempt {
  id: string;
  variant_id: string;
  attempted_at: string;
  status: "ok" | "error";
  external_post_id: string | null;
  error_message: string | null;
}

export interface ComposeRequest {
  ai_user_id: string;
  scheduled_for: string;
  variants: Array<{
    account_id: string;
    body: string;
    media_paths?: string[];
  }>;
}
