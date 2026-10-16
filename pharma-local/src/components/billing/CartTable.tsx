/**
 * Column 2 – Virtualized cart table.
 *
 * Displays line items in the current billing tab with a CSS-overflow
 * virtual scroll container (native browser scrolling, no extra deps).
 * Each row supports quantity editing, per-line discount, and removal.
 * F4 opens the item search dialog to add products.
 */

import { useState, useRef, useEffect } from "react";
import { Trash2, Keyboard, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { CartItem, CartTab } from "@/types";

interface CartTableProps {
  tab: CartTab;
  onRemoveItem: (itemId: string) => void;
  onUpdateQuantity: (itemId: string, qty: number) => void;
  onApplyItemDiscount: (itemId: string, discount: number) => void;
  onQuickAdd: () => void;
  shortcutHint?: string;
}

// Demo inventory items for F4 quick-add (offline-first)
const DEMO_ITEMS: {
  name: string;
  batch: string;
  rate: number;
  stock: number;
  mrp: number;
  gst_rate: number;
  unit: string;
  expiry_date: string;
}[] = [
  { name: "Paracetamol 500mg", batch: "BATCH-P101", rate: 12.5, stock: 50, mrp: 15.0, gst_rate: 18.0, unit: "STRIP", expiry_date: "2026-06-30" },
  { name: "Crocin Advance", batch: "BATCH-C202", rate: 25.0, stock: 30, mrp: 30.0, gst_rate: 18.0, unit: "STRIP", expiry_date: "2026-08-15" },
  { name: "Digene Gel", batch: "BATCH-D303", rate: 45.0, stock: 20, mrp: 55.0, gst_rate: 18.0, unit: "TUBE", expiry_date: "2026-11-20" },
  { name: "Vicks VapoRub", batch: "BATCH-V404", rate: 120.0, stock: 10, mrp: 145.0, gst_rate: 18.0, unit: "TUBE", expiry_date: "2027-03-10" },
  { name: "Dettol Handwash", batch: "BATCH-D505", rate: 85.0, stock: 25, mrp: 100.0, gst_rate: 5.0, unit: "BOTTLE", expiry_date: "2027-01-05" },
  { name: "Nurokind Plus", batch: "BATCH-N606", rate: 180.0, stock: 15, mrp: 210.0, gst_rate: 18.0, unit: "STRIP", expiry_date: "2026-09-25" },
  { name: "Azithromycin 500mg", batch: "BATCH-A707", rate: 45.0, stock: 40, mrp: 55.0, gst_rate: 18.0, unit: "STRIP", expiry_date: "2026-10-12" },
  { name: "Cough Syrup", batch: "BATCH-S808", rate: 110.0, stock: 12, mrp: 135.0, gst_rate: 18.0, unit: "BOTTLE", expiry_date: "2027-02-28" },
];

export function CartTable({
  tab,
  onRemoveItem,
  onUpdateQuantity,
  onApplyItemDiscount,
  onQuickAdd,
  shortcutHint = "F4",
}: CartTableProps) {
  const { items, tax_breakdown } = tab;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [discountEditingId, setDiscountEditingId] = useState<string | null>(null);
  const [discountValue, setDiscountValue] = useState("");

  const qtyInputRef = useRef<HTMLInputElement>(null);
  const discountInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && qtyInputRef.current) {
      qtyInputRef.current.focus();
      qtyInputRef.current.select();
    }
  }, [editingId]);

  useEffect(() => {
    if (discountEditingId && discountInputRef.current) {
      discountInputRef.current.focus();
      discountInputRef.current.select();
    }
  }, [discountEditingId]);

  const handleQtyKeyDown = (item: CartItem, e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === "Tab") {
      const qty = parseFloat(editValue) || 1;
      if (qty > 0 && qty !== item.quantity) {
        onUpdateQuantity(item.id, qty);
      }
      setEditingId(null);
      setEditValue("");
      e.preventDefault();
    } else if (e.key === "Escape") {
      setEditingId(null);
      setEditValue("");
      e.preventDefault();
    }
  };

  const handleDiscountKeyDown = (item: CartItem, e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === "Tab") {
      const discount = parseFloat(discountValue) || 0;
      onApplyItemDiscount(item.id, discount);
      setDiscountEditingId(null);
      setDiscountValue("");
      e.preventDefault();
    } else if (e.key === "Escape") {
      setDiscountEditingId(null);
      setDiscountValue("");
      e.preventDefault();
    }
  };

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(n);

  // Empty state
  if (items.length === 0) {
    return (
      <div className="flex flex-col h-full p-4">
        <div className="flex items-center justify-between border-b pb-2 mb-4">
          <h2 className="text-lg font-semibold">Cart Items</h2>
          <Badge variant="outline" className="text-xs">
            {shortcutHint}
          </Badge>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <p className="text-muted-foreground mb-4">No items in cart</p>
          <Button onClick={onQuickAdd} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Item (F4)
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-4">
      <div className="flex items-center justify-between border-b pb-2 mb-2">
        <h2 className="text-lg font-semibold">Cart Items ({items.length})</h2>
        <Badge variant="outline" className="text-xs">
          {shortcutHint}
        </Badge>
      </div>

      {/* Virtualized table container */}
      <div className="overflow-y-auto flex-1 border rounded-md">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 sticky top-0">
            <tr>
              <th className="text-left p-2 font-medium">#</th>
              <th className="text-left p-2 font-medium">Item</th>
              <th className="text-left p-2 font-medium">Batch</th>
              <th className="right p-2 font-medium">Qty</th>
              <th className="right p-2 font-medium">Rate</th>
              <th className="right p-2 font-medium">Disc.</th>
              <th className="right p-2 font-medium">Tax</th>
              <th className="right p-2 font-medium">Total</th>
              <th className="p-2 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr
                key={item.id}
                className="border-t hover:bg-accent/50 transition-colors"
              >
                <td className="p-2 align-top">{idx + 1}</td>

                {/* Item name */}
                <td className="p-2 align-top">
                  <div>
                    <span className="font-medium">{item.item.name}</span>
                    {item.item.hsn_code && (
                      <div className="text-xs text-muted-foreground">
                        HSN: {item.item.hsn_code}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground">
                      Expiry: {new Date(item.batch.expiry_date).toLocaleDateString()}
                    </div>
                  </div>
                </td>

                {/* Batch number */}
                <td className="p-2 align-top">{item.batch.batch_number}</td>

                {/* Quantity */}
                <td className="p-2 align-top text-right">
                  {editingId === item.id ? (
                    <Input
                      ref={qtyInputRef}
                      type="number"
                      min="1"
                      max={item.batch.stock}
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => handleQtyKeyDown(item, e)}
                      className="w-16 text-right h-7"
                      onBlur={() => {
                        setEditingId(null);
                        setEditValue("");
                      }}
                    />
                  ) : (
                    <button
                      className="hover:text-primary cursor-pointer"
                      onClick={() => {
                        setEditingId(item.id);
                        setEditValue(String(item.quantity));
                      }}
                    >
                      {item.quantity} {item.item.unit}
                    </button>
                  )}
                </td>

                {/* Rate */}
                <td className="p-2 align-top text-right">
                  {formatCurrency(item.rate)}
                </td>

                {/* Discount */}
                <td className="p-2 align-top text-right">
                  {discountEditingId === item.id ? (
                    <Input
                      ref={discountInputRef}
                      type="number"
                      min="0"
                      step="0.01"
                      value={discountValue}
                      onChange={(e) => setDiscountValue(e.target.value)}
                      onKeyDown={(e) => handleDiscountKeyDown(item, e)}
                      className="w-16 text-right h-7"
                      onBlur={() => {
                        setDiscountEditingId(null);
                        setDiscountValue("");
                      }}
                    />
                  ) : (
                    <button
                      className="hover:text-primary cursor-pointer"
                      onClick={() => {
                        setDiscountEditingId(item.id);
                        setDiscountValue(String(item.discount_amount));
                      }}
                    >
                      {item.discount_amount > 0
                        ? formatCurrency(item.discount_amount)
                        : "-"}
                    </button>
                  )}
                </td>

                {/* Tax */}
                <td className="p-2 align-top text-right">
                  {formatCurrency(item.tax_amount)}
                </td>

                {/* Total */}
                <td className="p-2 align-top text-right font-medium">
                  {formatCurrency(item.total_amount)}
                </td>

                {/* Action */}
                <td className="p-2 align-top">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemoveItem(item.id)}
                    title="Remove item"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Tax summary */}
      <div className="border-t pt-2 mt-2 text-sm space-y-1">
        <div className="flex justify-between">
          <span>CGST ({tax_breakdown.cgst_rate}%):</span>
          <span>{formatCurrency(tax_breakdown.cgst_amount)}</span>
        </div>
        <div className="flex justify-between">
          <span>SGST ({tax_breakdown.sgst_rate}%):</span>
          <span>{formatCurrency(tax_breakdown.sgst_amount)}</span>
        </div>
        {tax_breakdown.igst_amount > 0 && (
          <div className="flex justify-between">
            <span>IGST ({tax_breakdown.igst_rate}%):</span>
            <span>{formatCurrency(tax_breakdown.igst_amount)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// Re-export demo items for quick-add dialog usage
export { DEMO_ITEMS };
