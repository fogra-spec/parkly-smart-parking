declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    ASSETS?: Fetcher;
    PARKLY_AUTH_MODE?: string;
    PARKLY_BACKEND_URL?: string;
    PARKLY_BACKEND_KEY?: string;
    BUCKET?: R2Bucket;
  }
}
