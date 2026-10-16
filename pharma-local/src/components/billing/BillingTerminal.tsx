/**
 * BillingTerminal – The main billing UI (Section 7.4 of the PRD).
 *
 * A 3-column CSS Grid layout:
 *   Column 1: Customer search and details
 *   Column 2: Virtualized data table for the cart
 *   Column 3: Totals and action buttons
 *
 * Uses Zustand (useCartStore) for multi-tab billing state management
 * with keyboard shortcuts (F2, F4, F9, Esc) per Section 4.1.
 * All UI updates are optimistic — the store updates immediately
 * before any async backend call.
 */

import { useState, useEffect } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CustomerPanel } from "./CustomerPanel";
import { CartTable } from "./CartTable";
import { TotalsPanel } from "./TotalsPanel";
import { ItemSearchDialog } from "./ItemSearchDialog";
import { useCartStore } from "@/stores/useCartStore";

export function BillingTerminal() {
  const store = useCartStore();
  const [itemSearchOpen, setItemSearchOpen] = useState(false);
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);

  const activeTab = store.activeTab;

  // If no active tab, create one
  useEffect(() => {
    if (store.tabs.length === 0) {
      store.createTab();
    }
  }, [store]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!activeTab) return;

      // Don't trigger shortcuts when typing in an input
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      if (isInput && e.key !== "Escape") return;

      switch (e.key) {
        case "F2":
          e.preventDefault();
          setCustomerDialogOpen(true);
          break;
        case "F4":
          e.preventDefault();
          setItemSearchOpen(true);
          break;
        case "F9":
          e.preventDefault();
          handleCheckout();
          break;
        case "Escape":
          if (itemSearchOpen) {
            setItemSearchOpen(false);
          } else if (customerDialogOpen) {
            setCustomerDialogOpen(false);
          } else {
            e.preventDefault();
            store.clearCart();
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeTab, store, itemSearchOpen, customerDialogOpen]);

  const handleCheckout = async () => {
    if (!activeTab || activeTab.items.length === 0) return;
    if (!activeTab.customer) {
      alert("Please select a customer before checkout");
      setCustomerDialogOpen(true);
      return;
    }
    await store.checkout();
    store.clearCart();
  };

  // Tab bar operations
  const handleTabClick = (tabId: string) => {
    store.switchTab(tabId);
  };

  const handleCloseTab = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (store.tabs.length > 1) {
      store.closeTab(tabId);
    }
  };

  const handleNewTab = () => {
    store.createTab();
  };

  if (!activeTab) {
    return (
      <div className="flex items-center justify-center h-full">
        <Button onClick={handleNewTab}>New Tab</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Tab bar */}
      <div className="flex items-center gap-2 p-2 border-b bg-muted/20 overflow-x-auto">
        {store.tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabClick(tab.id)}
            className={`
              flex items-center gap-1 px-3 py-1.5 text-sm rounded-t-md border-b-2
              transition-colors whitespace-nowrap
              ${
                store.activeTabId === tab.id ||
                (store.activeTabId === null && tab.id === store.tabs[0]?.id)
                  ? "border-primary bg-background"
                  : "border-transparent hover:bg-muted/50"
              }
            `}
          >
            {tab.customer?.name ?? `Tab ${store.tabs.indexOf(tab) + 1}`}
            {tab.items.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {tab.items.length}
              </Badge>
            )}
            {store.tabs.length > 1 && (
              <X
                className="h-3 w-3 ml-1 hover:text-destructive"
                onClick={(e) => handleCloseTab(tab.id, e)}
              />
            )}
          </button>
        ))}
        <button
          onClick={handleNewTab}
          className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-t-md border-b-2 border-transparent hover:bg-muted/50 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Tab
        </button>
      </div>

      {/* 3-column grid */}
      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr_300px] gap-4 p-4 h-[calc(100vh-4rem)] overflow-hidden">
        {/* Column 1: Customer search and details */}
        <div className="border rounded-lg bg-card overflow-hidden">
          <CustomerPanel
            customer={activeTab.customer}
            onCustomerSelect={store.setCustomer}
            onAddCustomer={() => setCustomerDialogOpen(true)}
            shortcutHint="F2"
          />
        </div>

        {/* Column 2: Virtualized cart table */}
        <div className="border rounded-lg bg-card overflow-hidden">
          <CartTable
            tab={activeTab}
            onRemoveItem={store.removeItem}
            onUpdateQuantity={store.updateQuantity}
            onApplyItemDiscount={store.applyItemDiscount}
            onQuickAdd={() => setItemSearchOpen(true)}
            shortcutHint="F4"
          />
        </div>

        {/* Column 3: Totals and action buttons */}
        <div className="border rounded-lg bg-card overflow-hidden">
          <TotalsPanel
            tab={activeTab}
            store={store}
            shortcutCheckout="F9"
            shortcutClear="Esc"
          />
        </div>
      </div>

      {/* Item Search Dialog (F4) */}
      <ItemSearchDialog
        open={itemSearchOpen}
        onClose={() => setItemSearchOpen(false)}
        store={store}
      />

      {/* Customer Dialog (F2) - Simple inline version */}
      {customerDialogOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-popover border rounded-lg shadow-lg w-full max-w-md">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="text-lg font-semibold">Add New Customer</h3>
              <Button variant="ghost" size="sm" onClick={() => setCustomerDialogOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                In a production app, this form would save to the SQLite
                database via Tauri commands and return the new Customer
                object. For now, select from the demo customers in the
                Customer panel (Column 1).
              </p>
              <Button
                className="w-full"
                onClick={() => {
                  setCustomerDialogOpen(false);
                  // Focus the customer search input in column 1
                  const searchInput = document.querySelector(
                    "input[placeholder*='Search']",
                  ) as HTMLInputElement;
                  searchInput?.focus();
                }}
              >
                Go to Customer Search
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
