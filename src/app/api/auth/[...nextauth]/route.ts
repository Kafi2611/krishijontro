// Auth.js needs these two web addresses (GET and POST /api/auth/...) to read the
// session and handle login/logout requests. It is the only API route besides
// payment webhooks and file upload; everything else uses server actions.
import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;
