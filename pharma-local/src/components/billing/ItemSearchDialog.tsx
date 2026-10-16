/**
 * Item Search Dialog – opened with F4 to add items to the cart.
 *
 * Searches local inventory (offline-first), displays matching items
 * with their batch numbers, expiry dates, and available stock.
 * The cashier can select an item and specify quantity before adding
 * it to the active billing tab.
 */

import { useState, useEffect, useRef } from "react";
import { v4 as uuid } from "uuid";
import { Search, X, Package, Calendar, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DEMO_ITEMS } from "./CartTable";
import type { CartStore } from "@/stores/useCartStore";

interface ItemSearchDialogProps {
  open: boolean;
  onClose: () => void;
  store: CartStore;
}

export function ItemSearchDialog({
  open,
  onClose,
  store,
}: ItemSearchDialogProps) {
  const [query, setQuery] = useState("");
  const [selectedItemIndex, setSelectedItemIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus the search input when the dialog opens
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedItemIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Filter items based on search query
  const filtered = query.trim()
    ? DEMO_ITEMS.filter(
        (item) =>
          item.name.toLowerCase().includes(query.toLowerCase()) ||
          item.batch.toLowerCase().includes(query.toLowerCase()),
      )
    : DEMO_ITEMS;

  const handleAddItem = (item: (typeof DEMO_ITEMS)[0], qty: number) => {
    // Create synthetic Item and Batch objects for the store
    const itemObj = {
      id: uuid(),
      name: item.name,
      hsn_code: null,
      gst_rate: item.gst_rate,
      unit: "NOS",
      description: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const batchObj = {
      id: uuid(),
      item_id: itemObj.id,
      batch_number: item.batch,
      expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      mrp: item.mrp,
      rate: item.rate,
      stock: item.stock,
      min_stock: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    store.addItem(itemObj, batchObj, qty, item.rate);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
      e.preventDefault();
    } else if (e.key === "ArrowDown") {
      setSelectedItemIndex(Math.min(selectedItemIndex + 1, filtered.length - 1));
      e.preventDefault();
    } else if (e.key === "ArrowUp") {
      setSelectedItemIndex(Math.max(selectedItemIndex - 1, 0));
      e.preventDefault();
    } else if (e.key === "Enter" && filtered.length > 0) {
      handleAddItem(filtered[selectedItemIndex], 1);
      e.preventDefault();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center">
      <div
        className="bg-popover border rounded-lg shadow-lg w-full max-w-3xl max-h-[80vh] flex flex-col"
        onKeyDown={handleKeyDown}
        tabIndex={-1}
      >
        {/* Header */}
        <div className="flex items-center gap-2 p-4 border-b">
          <Search className="h-5 w-5 text-muted-foreground" />
          <Input
            ref={inputRef}
            type="text"
            placeholder="Search items by name, batch, or HSN code..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1"
          />
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No items found matching "{query}"
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/30 sticky top-0">
                <tr>
                  <th className="text-left p-3">#</th>
                  <th className="text-left p-3">Item Name</th>
                  <th className="text-left p-3">Batch</th>
                  <th className="text-right p-3">MRP</th>
                  <th className="text-right p-3">Rate</th>
                  <th className="text-right p-3">Stock</th>
                  <th className="text-right p-3">GST</th>
                  <th className="p-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item, idx) => {
                  const isSelected = idx === selectedItemIndex;
                  const isExpired = new Date(item.expiry_date) < new Date();
                  const isLowStock = item.stock <= 0;
                  const disabled = isLowStock || isExpired;

                  return (
                    <tr
                      key={`${item.name}-${item.batch}`}
                      className={
                        isSelected
                          ? "bg-accent/50 ring-1 ring-primary"
                          : "hover:bg-accent/30"
                      }
                    >
                      <td className="p-3 align-middle">{idx + 1}</td>

                      <td className="p-3 align-middle">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{item.name}</span>
                        </div>
                      </td>

                      <td className="p-3 align-middle">
                        <div className="flex items-center gap-1">
                          <Badge
                            variant={isExpired ? "destructive" : "secondary"}
                            className="text-xs"
                          >
                            {item.batch}
                          </Badge>
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            {new Date(item.expiry_date).toLocaleDateString()}
                          </span>
                        </div>
                      </td>

                      <td className="p-3 align-middle text-right">
                        ₹{item.mrp.toFixed(2)}
                      </td>

                      <td className="p-3 align-middle text-right text-primary">
                        ₹{item.rate.toFixed(2)}
                      </td>

                      <td className="p-3 align-middle text-right">
                        <span
                          className={
                            isLowStock ? "text-destructive font-bold" : ""
                          }
                        >
                          {item.stock} {item.unit}
                        </span>
                      </td>

                      <td className="p-3 align-middle text-right">
                        {item.gst_rate}%
                      </td>

                      <td className="p-3 align-middle">
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            disabled={disabled}
                            onClick={() => handleAddItem(item, 1)}
                          >
                            Add 1
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-3 bg-muted/20 flex justify-between items-center text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-3 w-3" />
            <span>
              {filtered.length} item{filtered.length !== 1 ? "s" : ""} found
            </span>
          </div>
          <div className="flex items-center gap-2">
            <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded">↑/↓</kbd>
            <span>to navigate</span>
            <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded">Enter</kbd>
            <span>to add</span>
            <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded">Esc</kbd>
            <span>to close</span>
          </div>
        </div>
      </div>
    </div>
  );
}
