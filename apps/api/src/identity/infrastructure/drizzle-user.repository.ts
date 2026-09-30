import { eq } from "drizzle-orm";
import { users } from "@/db/drizzle/schema.ts";
import type { Drizzle } from "@/infrastructure/drizzle.ts";
import { isOrbitThemeMode, isOrbitThemePalette } from "@orbit/shared/themes";
import { Email } from "../domain/email.ts";
import type { UserRepository } from "../domain/repositories.ts";
import { User, type UserId } from "../domain/user.ts";

type UserRow = {
  id: string;
  email: string;
  name: string;
  avatarTone: number;
  createdAt: Date;
  themeMode: string | null;
  themePalette: string | null;
};

function toDomain(row: UserRow): User {
  return User.rehydrate({
    id: row.id as UserId,
    email: Email.parse(row.email),
    name: row.name,
    avatarTone: row.avatarTone,
    createdAt: row.createdAt,
    themeMode: isOrbitThemeMode(row.themeMode) ? row.themeMode : null,
    themePalette: isOrbitThemePalette(row.themePalette)
      ? row.themePalette
      : null,
  });
}

export class DrizzleUserRepository implements UserRepository {
  constructor(private readonly db: Drizzle) {}

  async findById(id: UserId): Promise<User | null> {
    const rows = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return rows[0] ? toDomain(rows[0]) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const rows = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);
    return rows[0] ? toDomain(rows[0]) : null;
  }

  async save(user: User): Promise<void> {
    const now = new Date();
    await this.db
      .insert(users)
      .values({
        id: user.id,
        email: user.email.value,
        name: user.name,
        avatarTone: user.avatarTone,
        createdAt: user.createdAt,
        updatedAt: now,
        themeMode: user.themeMode,
        themePalette: user.themePalette,
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: user.email.value,
          name: user.name,
          avatarTone: user.avatarTone,
          themeMode: user.themeMode,
          themePalette: user.themePalette,
          updatedAt: now,
        },
      });
  }
}
