// Adds our own fields (id, role, phone) to Auth.js types, so TypeScript knows
// that session.user.role exists and is one of our 8 roles.
import type { DefaultSession } from "next-auth";
import type { Role } from "@/generated/prisma/enums";

declare module "@auth/core/types" {
  // What authorize() in lib/auth.ts returns after a correct password
  interface User {
    role: Role;
    phone: string;
  }

  // What auth() gives back on any server page: session.user.id, .role, .phone, .name
  interface Session {
    user: {
      id: string;
      role: Role;
      phone: string;
    } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  // What we keep inside the signed login cookie
  interface JWT {
    id: string;
    role: Role;
    phone: string;
  }
}
