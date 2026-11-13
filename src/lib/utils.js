import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
} 


export const isIframe = window.self !== window.top;

/** Clicar num aviso (toast do sonner, fora do diálogo) não fecha o diálogo ou painel aberto. */
export const naoFecharNoAviso = (fn) => (e) => {
    if (e.target?.closest?.('[data-sonner-toaster]')) e.preventDefault();
    fn?.(e);
};
