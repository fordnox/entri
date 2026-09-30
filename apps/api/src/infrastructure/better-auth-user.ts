// +feature:orm-drizzle
import { eq } from "drizzle-orm";
import { users } from "@/db/drizzle/schema.ts";
// -feature:orm-drizzle
import type { AppContainer } from "@/composition.ts";

/**
 * ORM-agnostic reads/writes against the better-auth-managed `users`
 * table. The auth aggregate is not part of any domain repository —
 * better-auth owns the schema — so these small helpers bridge the gap
 * without leaking `container.drizzle` into HTTP
 * controllers.
 *
 * Each helper branches inside a `+feature:orm-*` fence so exactly one
 * path survives the strip. In the monorepo both branches compile; at
 * runtime the first `return` wins, and the second is dead code.
 */

// +feature:auth-admin
// +feature:audit-log
import { AppUserRoleChanged } from "@/identity/domain/app-admin-events.ts";
import type { UserId } from "@/identity/domain/user.ts";
// -feature:audit-log

export async function readAppAdminRow(
  container: AppContainer,
  userId: string,
): Promise<{ role: string | null; banned: boolean } | null> {
  // +feature:orm-drizzle
  const rows = await container.drizzle
    .select({ role: users.role, banned: users.banned })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const r = rows[0];
  return r ? { role: r.role, banned: r.banned } : null;
  // -feature:orm-drizzle
}

export async function promoteToAppAdmin(
  container: AppContainer,
  userId: string,
): Promise<void> {
  const before = await readAppAdminRow(container, userId);
  const previousRole = before?.role ?? null;

  // +feature:orm-drizzle
  await container.drizzle
    .update(users)
    .set({ role: "admin" })
    .where(eq(users.id, userId));
  // -feature:orm-drizzle

  if (previousRole !== "admin") {
    // Self-promotion: actor and target are the same user. When the
    // better-auth admin plugin's setRole endpoint is wrapped in a
    // separate integration, that path will pass the acting admin's id
    // through here as the `actor`.
    // +feature:audit-log
    await container.bus.publish(
      new AppUserRoleChanged(
        userId as UserId,
        previousRole,
        "admin",
        userId as UserId,
        container.clock.now(),
      ),
    );
    // -feature:audit-log
  }
}
// -feature:auth-admin

