// Unit tests for support tickets: the new ticket and reply forms (validators/support.ts),
// and the Help page being open to every logged-in user (roles.ts, role-nav.ts).
import { describe, expect, it } from "vitest";
import { getNavItemsForRole } from "@/lib/role-nav";
import { isAccountPath } from "@/lib/roles";
import { newTicketSchema, replySchema } from "@/lib/validators/support";

describe("newTicketSchema", () => {
  const ticket = { subject: "Operator came late", bookingId: "", message: "He came one hour late." };

  it("accepts a ticket with or without a booking", () => {
    expect(newTicketSchema.safeParse(ticket).success).toBe(true);
    expect(newTicketSchema.safeParse({ ...ticket, bookingId: "abc" }).success).toBe(true);
  });

  it("needs a subject and a message", () => {
    expect(newTicketSchema.safeParse({ ...ticket, subject: "Hi" }).error?.issues[0].message).toBe("subjectRequired");
    expect(newTicketSchema.safeParse({ ...ticket, message: "   " }).error?.issues[0].message).toBe("messageRequired");
  });
});

describe("replySchema", () => {
  it("needs at least 2 letters and at most 1000", () => {
    expect(replySchema.safeParse({ body: "ok" }).success).toBe(true);
    expect(replySchema.safeParse({ body: " " }).success).toBe(false);
    expect(replySchema.safeParse({ body: "x".repeat(1001) }).error?.issues[0].message).toBe("tooLong");
  });
});

describe("the Help page", () => {
  it("is open to every logged-in user", () => {
    expect(isAccountPath("/support")).toBe(true);
    expect(isAccountPath("/support/new")).toBe(true);
  });

  it("is in every sidebar except the admin's (admins answer the tickets instead)", () => {
    expect(getNavItemsForRole("FARMER").some((item) => item.href === "/support")).toBe(true);
    expect(getNavItemsForRole("TECHNICIAN").some((item) => item.href === "/support")).toBe(true);
    expect(getNavItemsForRole("ADMIN").some((item) => item.href === "/support")).toBe(false);
    expect(getNavItemsForRole("ADMIN").some((item) => item.href === "/admin/tickets")).toBe(true);
  });
});
