"use client";

import { useCurrentTheme } from "@/hooks/use-current-theme";
import { UserButton } from "@clerk/nextjs";
import { dark } from "@clerk/themes";

interface IUserControlProps {
  showName?: boolean;
}

export const UserControl = ({ showName }: IUserControlProps) => {
  const currentTheme = useCurrentTheme();
  return (
    <UserButton
      showName={showName}
      appearance={{
        elements: {
          userButtonBox: "rounded-md!",
          userButtonAvatarBox: "rounded-md! size-8!",
          userButtonTrigger: "rounded-md!",
        },
        baseTheme: currentTheme === "dark" ? dark : undefined,
      }}
    />
  );
};
