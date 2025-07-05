import { useTheme } from "next-themes";

export const useCurrentTheme = () => {
  const { theme, systemTheme } = useTheme();
  if (theme === "system") {
    return systemTheme;
  }
  return theme;
};
