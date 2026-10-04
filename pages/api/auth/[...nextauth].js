// ============================================================================
// /api/auth/[...nextauth]
// Discord login through NextAuth. Only the "identify" scope is requested:
// username, avatar and Discord ID. Credentials come from .env.
// ============================================================================
import NextAuth from 'next-auth';
import DiscordProvider from 'next-auth/providers/discord';

export const authOptions = {
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
      authorization: { params: { scope: 'identify' } },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,

  // Stateless sessions: no database required
  session: { strategy: 'jwt' },

  callbacks: {
    // Store the Discord user ID in the token on first sign-in
    async jwt({ token, account, profile }) {
      if (account && profile) token.discordId = profile.id;
      return token;
    },
    // Expose the Discord ID to the client as session.user.id
    async session({ session, token }) {
      if (session.user) session.user.id = token.discordId ?? token.sub;
      return session;
    },
  },
};

export default NextAuth(authOptions);
