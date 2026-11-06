// What the page needs before React: the key of the saved look and the script that applies it before the first paint (no React here, the layout is a server component).
export const THEME_KEY = "examBuilder.theme";

export const THEME_BOOT_SCRIPT = `try{var m=localStorage.getItem(${JSON.stringify(THEME_KEY)});if(m!=="light"&&m!=="dark")m="system";var d=m==="dark"||(m==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;r.dataset.theme=d?"dark":"light";r.dataset.themeMode=m}catch(e){}`;
