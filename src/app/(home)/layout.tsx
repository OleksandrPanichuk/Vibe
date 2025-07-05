import { Navbar } from "@/modules/home/ui/components/navbar";
import { PropsWithChildren } from "react";

const Layout = ({ children }: PropsWithChildren) => {
  return (
    <main className="flex flex-col min-h-screen max-h-screen ">
      <Navbar />
      <div className="flex-1 flex flex-col px-4 pb-4 bg-background dark:bg-[radial-gradient(#393e4a_1px,transparent_1px)] bg-[radial-gradient(#dadde2_1px,transparent_1px)] [background-size:16px_16px]">
        {/* <div className="absolute inset-0 -z-10 h-full w-full bg-background dark:bg-[radial-gradient(#393e4a_1px,transparent_1px)] bg-[radial-gradient(#dadde2_1px,transparent_1px)] [background-size:16px_16px]" /> */}
        {children}
      </div>
    </main>
  );
};

export default Layout;
