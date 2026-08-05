type AuthUser = {
  email?: string | null;
  last_sign_in_at?: string | null;
};

type AuthUserPage = {
  data: { users: AuthUser[] };
  error: Error | null;
};

type AuthUserAdmin = {
  listUsers(params: { page: number; perPage: number }): Promise<AuthUserPage>;
};

const AUTH_USERS_PER_PAGE = 1000;
const MAX_AUTH_USER_PAGES = 100;

export async function findAuthUserByEmail(admin: AuthUserAdmin, email: string) {
  const normalizedEmail = email.trim().toLowerCase();

  for (let page = 1; page <= MAX_AUTH_USER_PAGES; page += 1) {
    const { data, error } = await admin.listUsers({
      page,
      perPage: AUTH_USERS_PER_PAGE,
    });

    if (error) throw error;

    const user = data.users.find(
      (candidate) => candidate.email?.trim().toLowerCase() === normalizedEmail
    );
    if (user) return user;
    if (data.users.length < AUTH_USERS_PER_PAGE) return null;
  }

  throw new Error("Could not finish checking existing Beckett accounts.");
}
