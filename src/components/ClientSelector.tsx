import { useState, useMemo } from "react";
import { Check, ChevronsUpDown, Plus, Search } from "lucide-react";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAgencyStore, Client } from "@/lib/store";
import { QuickAddClientModal } from "@/components/QuickAddClientModal";

interface ClientSelectorProps {
  value: string;
  onValueChange: (value: string, client?: Client) => void;
  error?: string;
}

export function ClientSelector({ value, onValueChange, error }: ClientSelectorProps) {
  const [open, setOpen] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const { clients } = useAgencyStore();

  const selectedClient = useMemo(() => {
    return clients.find((client) => (client.company || client.name) === value);
  }, [clients, value]);

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-full justify-between h-11 px-3 text-left font-normal",
              !value && "text-muted-foreground",
              error && "border-destructive"
            )}
          >
            {value
              ? (selectedClient?.company || selectedClient?.name || value)
              : "Select a client..."}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command className="w-full">
            <CommandInput placeholder="Search clients..." className="h-9" />
            <CommandList>
              <CommandEmpty>No client found.</CommandEmpty>
              <CommandGroup>
                <CommandItem
                  onSelect={() => {
                    setShowAddModal(true);
                    setOpen(false);
                  }}
                  className="flex items-center gap-2 text-primary font-medium"
                >
                  <Plus className="h-4 w-4" />
                  Add New Client
                </CommandItem>
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup heading="Recent Clients">
                {clients.map((client) => {
                  const clientName = client.company || client.name;
                  return (
                    <CommandItem
                      key={client.id}
                      value={clientName}
                      onSelect={() => {
                        onValueChange(clientName === value ? "" : clientName, client);
                        setOpen(false);
                      }}
                    >
                      <div className="flex flex-col">
                        <span className="font-medium">{clientName}</span>
                        <span className="text-xs text-muted-foreground">{client.email}</span>
                      </div>
                      <Check
                        className={cn(
                          "ml-auto h-4 w-4",
                          value === clientName ? "opacity-100" : "opacity-0"
                        )}
                      />
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      
      <QuickAddClientModal 
        open={showAddModal} 
        onOpenChange={setShowAddModal}
        onSuccess={(client) => {
          onValueChange(client.company || client.name, client);
        }}
      />
    </div>
  );
}
