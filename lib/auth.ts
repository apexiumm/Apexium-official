// lib/auth.ts
import { type NextAuthOptions } from "next-auth";
import TwitterProvider from "next-auth/providers/twitter";
import type { JWT } from "next-auth/jwt";
import type { Session } from "next-auth";

import { connectToDB } from "@/lib/mongodb";
import { User } from "@/models/User";

// Twitter v2 profile type
interface TwitterProfile {
  data: {
    id: string;
    name: string;
    username: string;
    profile_image_url: string;
  };
}

export const authOptions: NextAuthOptions = {
  providers: [
    TwitterProvider({
      clientId: process.env.TWITTER_CLIENT_ID!,
      clientSecret: process.env.TWITTER_CLIENT_SECRET!,
      version: "2.0",
      profile(profile: TwitterProfile) {
        return {
          id: profile.data.id,
          name: profile.data.name,
          email: null,
          image: profile.data.profile_image_url,
          username: profile.data.username,
        };
      },
    }),
  ],

  secret: process.env.NEXTAUTH_SECRET,

  cookies:
    process.env.NODE_ENV === "production"
      ? {
          sessionToken: {
            name: "__Secure-next-auth.session-token",
            options: {
              httpOnly: true,
              sameSite: "lax",
              path: "/",
              secure: true,
            },
          },
        }
      : undefined,

  callbacks: {
    async jwt({ token, user }): Promise<JWT> {
      if (user?.username) token.username = user.username;
      if (user?.id) token.twitterId = user.id;
      return token;
    },

    async session({ session, token }): Promise<Session> {
      session.user.id = token.twitterId as string;
      session.user.username = token.username as string;
      session.user.image = session.user.image || "";
      return session;
    },

    async signIn({ user }) {
      try {
        await connectToDB();
        if (!user?.id) return false;

        await User.findOneAndUpdate(
          { twitterId: user.id },
          {
            twitterId: user.id,
            username: user.username || "Unknown",
            avatar: user.image || "",
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        return true;
      } catch (err) {
        console.error("Error saving user to DB:", err);
        return true; // allow login even if DB fails
      }
    },

    async redirect({ url }) {
      if (url.includes("/api/auth/signout")) return "/";
      return "/dashboard";
    },
  },

  debug: process.env.NODE_ENV === "development",
};
