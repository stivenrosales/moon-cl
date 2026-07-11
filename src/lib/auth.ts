import NextAuth, { type DefaultSession } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Resend from "next-auth/providers/resend";
import Nodemailer from "next-auth/providers/nodemailer";
import { db } from "@/lib/db";
import { getInitialAdminEmails } from "@/lib/permissions";
import { buildMagicLinkHtml, buildMagicLinkText } from "@/lib/email";
import type { Role } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      onboardedAt: Date | null;
      birthday: Date | null;
    } & DefaultSession["user"];
  }
  interface User {
    role?: Role;
    onboardedAt?: Date | null;
    birthday?: Date | null;
  }
}

const useResend = !!process.env.AUTH_RESEND_KEY;
const useSmtp = !useResend && !!process.env.EMAIL_SERVER_HOST;

const emailProvider = useResend
  ? Resend({
      apiKey: process.env.AUTH_RESEND_KEY,
      from: process.env.EMAIL_FROM ?? "Moon Club <onboarding@resend.dev>",
      sendVerificationRequest: async ({ identifier, url, provider }) => {
        const { Resend } = await import("resend");
        const resend = new Resend(provider.apiKey as string);
        const host = new URL(url).host;
        await resend.emails.send({
          from: provider.from as string,
          to: identifier,
          subject: "Tu enlace mágico para Moon Club de Lectura",
          html: buildMagicLinkHtml({ url, host }),
          text: buildMagicLinkText({ url, host }),
        });
      },
    })
  : useSmtp
  ? Nodemailer({
      server: {
        host: process.env.EMAIL_SERVER_HOST,
        port: Number(process.env.EMAIL_SERVER_PORT ?? 587),
        auth: {
          user: process.env.EMAIL_SERVER_USER,
          pass: process.env.EMAIL_SERVER_PASSWORD,
        },
      },
      from: process.env.EMAIL_FROM ?? "Moon Club <noreply@example.com>",
      sendVerificationRequest: async ({ identifier, url, provider }) => {
        const nodemailer = await import("nodemailer");
        const transport = nodemailer.createTransport(provider.server as never);
        const host = new URL(url).host;
        await transport.sendMail({
          to: identifier,
          from: provider.from as string,
          subject: "Tu enlace mágico para Moon Club de Lectura",
          html: buildMagicLinkHtml({ url, host }),
          text: buildMagicLinkText({ url, host }),
        });
      },
    })
  : Resend({
      apiKey: "missing",
      from: "Moon Club <onboarding@resend.dev>",
      sendVerificationRequest: async ({ identifier, url }) => {
        // En dev sin email configurado: imprime el enlace en consola.
        // eslint-disable-next-line no-console
        console.log(
          `\n\n🌙  Magic link para ${identifier}:\n${url}\n\n(Configura AUTH_RESEND_KEY o EMAIL_SERVER_* para enviar email real.)\n`,
        );
      },
    });

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: "database" },
  pages: {
    signIn: "/login",
    verifyRequest: "/login/verify",
    error: "/login",
  },
  providers: [emailProvider],
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        session.user.role = (user as { role?: Role }).role ?? "MEMBER";
        // Con session strategy "database" el adapter resuelve el User
        // completo (incluye onboardedAt/birthday) en cada auth(), así que
        // no hace falta una query aparte para el gate de onboarding.
        session.user.onboardedAt =
          (user as { onboardedAt?: Date | null }).onboardedAt ?? null;
        session.user.birthday = (user as { birthday?: Date | null }).birthday ?? null;
      }
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      // Promueve a ADMIN si el email está en la lista inicial.
      const adminEmails = getInitialAdminEmails();
      if (user.email && adminEmails.includes(user.email.toLowerCase())) {
        await db.user.update({
          where: { id: user.id },
          data: { role: "ADMIN" },
        });
      }
    },
  },
});
