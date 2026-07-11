import { describe, expect, it, vi } from "vitest";
import { booksInCommon, getFollowCounts } from "@/server/services/social";

function createFakeClient(overrides: {
  userBookFindMany?: ReturnType<typeof vi.fn>;
  ratingFindMany?: ReturnType<typeof vi.fn>;
  followCount?: ReturnType<typeof vi.fn>;
} = {}) {
  return {
    userBook: {
      findMany: overrides.userBookFindMany ?? vi.fn().mockResolvedValue([]),
    },
    rating: {
      findMany: overrides.ratingFindMany ?? vi.fn().mockResolvedValue([]),
    },
    follow: {
      count: overrides.followCount ?? vi.fn().mockResolvedValue(0),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("booksInCommon", () => {
  it("cuenta los libros que aparecen en la estantería o valoraciones de ambos usuarios", async () => {
    const userBookFindMany = vi.fn(async ({ where }: { where: { userId: string } }) => {
      if (where.userId === "user-a") return [{ bookId: "b1" }, { bookId: "b2" }];
      return [{ bookId: "b2" }, { bookId: "b4" }];
    });
    const ratingFindMany = vi.fn(async ({ where }: { where: { userId: string } }) => {
      if (where.userId === "user-a") return [{ bookId: "b3" }];
      return [{ bookId: "b1" }];
    });
    const client = createFakeClient({ userBookFindMany, ratingFindMany });

    // userA: {b1, b2, b3} · userB: {b1, b2, b4} → comunes: {b1, b2}
    const result = await booksInCommon("user-a", "user-b", client);

    expect(result).toBe(2);
  });

  it("retorna 0 cuando no hay libros compartidos", async () => {
    const userBookFindMany = vi.fn(async ({ where }: { where: { userId: string } }) => {
      if (where.userId === "user-a") return [{ bookId: "b1" }];
      return [{ bookId: "b2" }];
    });
    const client = createFakeClient({ userBookFindMany, ratingFindMany: vi.fn().mockResolvedValue([]) });

    const result = await booksInCommon("user-a", "user-b", client);

    expect(result).toBe(0);
  });

  it("no duplica un libro que aparece tanto en la estantería como en las valoraciones del mismo usuario", async () => {
    const userBookFindMany = vi.fn().mockResolvedValue([{ bookId: "b1" }]);
    const ratingFindMany = vi.fn().mockResolvedValue([{ bookId: "b1" }]);
    const client = createFakeClient({ userBookFindMany, ratingFindMany });

    const result = await booksInCommon("user-a", "user-b", client);

    expect(result).toBe(1);
  });

  it("consulta la estantería y valoraciones de cada usuario por separado", async () => {
    const userBookFindMany = vi.fn().mockResolvedValue([]);
    const ratingFindMany = vi.fn().mockResolvedValue([]);
    const client = createFakeClient({ userBookFindMany, ratingFindMany });

    await booksInCommon("user-a", "user-b", client);

    expect(userBookFindMany).toHaveBeenCalledWith({
      where: { userId: "user-a" },
      select: { bookId: true },
    });
    expect(userBookFindMany).toHaveBeenCalledWith({
      where: { userId: "user-b" },
      select: { bookId: true },
    });
    expect(ratingFindMany).toHaveBeenCalledWith({
      where: { userId: "user-a" },
      select: { bookId: true },
    });
  });
});

describe("getFollowCounts", () => {
  it("cuenta followers (te siguen) y following (sigues) por separado", async () => {
    const followCount = vi.fn(async ({ where }: { where: { followingId?: string; followerId?: string } }) => {
      if (where.followingId === "user-a") return 5;
      if (where.followerId === "user-a") return 2;
      return 0;
    });
    const client = createFakeClient({ followCount });

    const result = await getFollowCounts("user-a", client);

    expect(result).toEqual({ followers: 5, following: 2 });
    expect(followCount).toHaveBeenCalledWith({ where: { followingId: "user-a" } });
    expect(followCount).toHaveBeenCalledWith({ where: { followerId: "user-a" } });
  });
});
