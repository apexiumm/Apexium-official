import { DefaultSession, DefaultUser } from "next-auth";

// Extend NextAuth types
declare module "next-auth" {
  interface Session {
    user: {
      id: string;                  // ✅ Twitter ID
      username?: string | null;    // ✅ Twitter handle
      name?: string | null;
      email?: string | null;
      image?: string | null;
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    id: string;                   // ✅ store Twitter ID
    username?: string | null;
    avatar?: string | null;
  }
}

// Extend JWT
declare module "next-auth/jwt" {
  interface JWT {
    twitterId?: string;
    username?: string | null;
  }
}
