import { SignOutButton } from "@/SignOutButton";
import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { Toaster } from "sonner";
import { api } from "../../convex/_generated/api";
import { TypingDuelGame } from "@/TypingDuelGame";
import { SignInForm } from "@/SignInForm";

export default function Home() {
  const loggedInUser = useQuery(api.auth.loggedInUser);
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="sticky top-0 z-10  backdrop-blur-sm h-16 flex justify-between items-center  px-4">
        <h2 className="text-xl font-semibold text-blue-600">Typing Battle</h2>
        <Authenticated>
          {loggedInUser && (
            <div className="flex items-center gap-2 bg-gray-100 px-3 py-1 rounded-full">
              <img src="/dollar.png" alt="score" className="size-5 shrink-0" />{" "}
              <p>{loggedInUser.score || "00"}</p>
            </div>
          )}
          <SignOutButton />
        </Authenticated>
      </header>
      <main className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-4xl mx-auto">
          <Content />
        </div>
      </main>
      <Toaster />
    </div>
  );
}

function Content() {
  const loggedInUser = useQuery(api.auth.loggedInUser);

  if (loggedInUser === undefined) {
    return (
      <div className="flex justify-center items-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <Authenticated>
          <p className="text-2xl ">
            Welcome, {loggedInUser?.name || loggedInUser?.email || "Duelist"}!
          </p>
        </Authenticated>
        <Unauthenticated>
          <p className="text-xl text-gray-600">Sign in to start dueling</p>
        </Unauthenticated>
      </div>

      <Authenticated>
        <TypingDuelGame />
      </Authenticated>

      <Unauthenticated>
        <div className="max-w-md mx-auto">
          <SignInForm />
        </div>
      </Unauthenticated>
    </div>
  );
}
