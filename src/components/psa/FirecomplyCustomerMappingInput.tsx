import { useEffect, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { loadOrgResolvedCustomerNames } from "@/lib/org-customer-names";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/** Searchable FireComply customer label for PSA mappings (Customers page resolution). */
export function FirecomplyCustomerMappingInput({
  value,
  onChange,
  disabled,
  label = "FireComply customer",
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  label?: string;
}) {
  const { org } = useAuth();
  const [customerNames, setCustomerNames] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [customMode, setCustomMode] = useState(false);

  useEffect(() => {
    if (!value) setCustomMode(false);
  }, [value]);

  useEffect(() => {
    if (!org?.id || !org.name) {
      setCustomerNames([]);
      return;
    }
    let cancelled = false;
    void loadOrgResolvedCustomerNames(org.id, org.name).then((names) => {
      if (!cancelled) setCustomerNames(names);
    });
    return () => {
      cancelled = true;
    };
  }, [org?.id, org?.name]);

  return (
    <div className="space-y-1 min-w-0">
      <label className="text-[10px] text-foreground">{label}</label>
      {!customMode ? (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={open}
              disabled={disabled}
              className="h-8 w-full justify-between px-2 text-xs font-normal text-foreground"
            >
              <span className="truncate">{value || "Select customer…"}</span>
              <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
            <Command>
              <CommandInput placeholder="Search…" className="h-9 text-xs" />
              <CommandList>
                <CommandEmpty className="text-xs py-3">No match.</CommandEmpty>
                <CommandGroup>
                  {customerNames.map((n) => (
                    <CommandItem
                      key={n}
                      value={n}
                      className="text-xs"
                      onSelect={() => {
                        onChange(n);
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-3.5 w-3.5 shrink-0",
                          value === n ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <span className="truncate">{n}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    value="__custom"
                    className="text-xs"
                    onSelect={() => {
                      setCustomMode(true);
                      setOpen(false);
                    }}
                  >
                    Type custom name…
                  </CommandItem>
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      ) : (
        <div className="space-y-1">
          <Input
            className="h-8 text-xs"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Exact customer label"
            disabled={disabled}
          />
          <button
            type="button"
            className="text-[10px] text-brand-accent font-medium hover:underline"
            onClick={() => {
              setCustomMode(false);
              onChange("");
            }}
          >
            Choose from list
          </button>
        </div>
      )}
    </div>
  );
}
