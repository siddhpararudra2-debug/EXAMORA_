import { FileQuestion, Home } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-white">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/90 p-8 text-center shadow-2xl backdrop-blur">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-slate-800 text-indigo-400 ring-8 ring-slate-800/50">
          <FileQuestion className="h-10 w-10" />
        </div>

        <h1 className="mt-6 text-2xl font-bold tracking-tight text-white">
          404 — Page not found
        </h1>

        <p className="mt-2 text-sm text-slate-400 leading-relaxed">
          The page you are looking for does not exist or has been moved.
        </p>

        <div className="mt-8 flex items-center justify-center gap-3">
          <Link href="/">
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
              <Home className="h-4 w-4" /> Go Home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
