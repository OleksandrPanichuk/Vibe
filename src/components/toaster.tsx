"use client"

import { useTheme } from "next-themes"
import { Toaster  as SonnerToaster} from "sonner"


export const Toaster = () => {
    const {theme} = useTheme()

    return <SonnerToaster theme={theme as 'dark' | 'light' | 'system'} />
}