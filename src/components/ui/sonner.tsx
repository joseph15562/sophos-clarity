import { Toaster as Sonner, toast } from "sonner";
import { useResolvedThemeClass } from "@/hooks/use-resolved-appearance";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const sonnerTheme = useResolvedThemeClass() as ToasterProps["theme"];

  return (
    <Sonner
      theme={sonnerTheme}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-white/88 dark:group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border/70 group-[.toaster]:shadow-elevated group-[.toaster]:backdrop-blur-xl",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
