import NextAuth from "next-auth";
import { authOptions } from "@/lib/authOptions";

// `default`プロパティを考慮して関数を取得
const NextAuthFunc = NextAuth.default ?? NextAuth;

const handler = NextAuthFunc(authOptions);

export { handler as GET, handler as POST }; 