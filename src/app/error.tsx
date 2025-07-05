"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";

const ErrorPage = () => {
  return (
    <div className="min-h-screen flex items-center justify-center w-full flex-col gap-2">
      <div>Something went wrong</div>
      <Button size={"sm"} asChild>
        <Link href={"/"}>Go back to home</Link>
      </Button>
    </div>
  );
};

export default ErrorPage;
