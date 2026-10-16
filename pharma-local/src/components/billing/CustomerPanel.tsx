/**
 * Column 1 – Customer search and details panel.
 *
 * Allows the cashier to search for a customer by phone number or name,
 * view their details, and link them to the current billing tab.
 * F2 opens the "new customer" dialog / switches to customer search.
 */

import { useState, useEffect } from "react";
import { Search, Plus, Trash2, Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { Customer } from "@/types";

interface CustomerPanelProps {
  customer: Customer | null;
  onCustomerSelect: (customer: Customer | null) => void;
  onAddCustomer: () => void;
  shortcutHint?: string;
}

// Simple local customer registry for demo purposes (offline-first)
const DEMO_CUSTOMERS: Customer[] = [
  {
    id: "cust-001",
    name: "Rajesh Kumar",
    phone: "9876543210",
    address: "123 Main Road, Delhi - 110001",
    gstin: "07AABCCDDEEFFG",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "cust-002",
    name: "Priya Sharma",
    phone: "9123456789",
    address: "456 Park Street, Mumbai - 400001",
    gstin: "27AABBCCDDEEFF",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "cust-003",
    name: "Amit Patel",
    phone: "9988776655",
    address: "789 Gandhi Road, Ahmedabad - 380001",
    gstin: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export function CustomerPanel({
  customer,
  onCustomerSelect,
  onAddCustomer,
  shortcutHint = "F2",
}: CustomerPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Customer[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // Filter demo customers based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const q = searchQuery.toLowerCase();
    const results = DEMO_CUSTOMERS.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone ?? "").includes(q) ||
        (c.gstin ?? "").toLowerCase().includes(q),
    );
    setSearchResults(results);
  }, [searchQuery]);

  const handleCustomerClick = (c: Customer) => {
    onCustomerSelect(c);
    setShowResults(false);
    setSearchQuery("");
  };

  const handleRemoveCustomer = () => {
    onCustomerSelect(null);
  };

  const handleAddCustomer = () => {
    onAddCustomer();
  };

  return (
    <div className="flex flex-col h-full p-4 space-y-4">
      {/* Search header */}
      <div className="flex items-center gap-2 border-b pb-2">
        <h2 className="text-lg font-semibold">Customer</h2>
        <Badge variant="outline" className="text-xs">
          {shortcutHint}
        </Badge>
      </div>

      {/* Customer details or search */}
      {customer ? (
        <div className="space-y-3 flex-1">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-bold text-lg">{customer.name}</h3>
              <p className="text-sm text-muted-foreground">
                {customer.phone && `📞 ${customer.phone}`}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRemoveCustomer}
              title="Remove customer (Esc also works)"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          {customer.address && (
            <p className="text-sm text-muted-foreground break-words">
              {customer.address}
            </p>
          )}

          {customer.gstin && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                GSTIN: {customer.gstin}
              </Badge>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 space-y-3">
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none z-10">
              <Search className="h-4 w-4" />
            </div>
            <Input
              type="text"
              placeholder="Search by name, phone, or GSTIN..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setShowResults(true)}
              className="pl-10"
              autoFocus
            />
          </div>

          {/* Search results */}
          {showResults && searchResults.length > 0 && (
            <div className="border rounded-md max-h-40 overflow-y-auto">
              {searchResults.map((c) => (
                <button
                  key={c.id}
                  className="w-full text-left p-3 hover:bg-accent hover:text-accent-foreground border-b last:border-0 transition-colors"
                  onClick={() => handleCustomerClick(c)}
                >
                  <div className="font-medium">{c.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {c.phone}
                  </div>
                </button>
              ))}
            </div>
          )}

          {showResults && searchQuery && searchResults.length === 0 && (
            <p className="text-sm text-muted-foreground">No customers found</p>
          )}

          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={handleAddCustomer}
          >
            <Plus className="h-4 w-4" />
            Add New Customer
          </Button>
        </div>
      )}

      {/* Shortcut help */}
      <div className="mt-auto text-xs text-muted-foreground flex items-center gap-2">
        <Keyboard className="h-3 w-3" />
        <span>
          {shortcutHint}: Customer search | F4: Add item | F9: Checkout | Esc: Clear
        </span>
      </div>
    </div>
  );
}
