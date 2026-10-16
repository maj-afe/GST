/**
 * Column 3 – Totals and action panel.
 *
 * Displays the running subtotal, discount, tax breakdown (CGST/SGST/IGST),
 * and grand total. Includes payment mode selection and the Checkout (F9)
 * and Clear Cart (Esc) buttons.
 */

import { useState } from "react";
import { Banknote, Trash2, Keyboard, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { CartTab } from "@/types";
import type { CartStore } from "@/stores/useCartStore";

interface TotalsPanelProps {
  tab: CartTab;
  store: CartStore;
  shortcutCheckout?: string;
  shortcutClear?: string;
}

const PAYMENT_OPTIONS = [
  { value: "CASH", label: "💵 Cash" },
  { value: "CARD", label: "💳 Card" },
  { value: "UPI", label: "📱 UPI" },
  { value: "ONLINE", label: "🌐 Online" },
];

export function TotalsPanel({
  tab,
  store,
  shortcutCheckout = "F9",
  shortcutClear = "Esc",
}: TotalsPanelProps) {
  const [showDiscountInput, setShowDiscountInput] = useState(false);
  const [discountInputValue, setDiscountInputValue] = useState("");
  const [discountInputType, setDiscountInputType] = useState<"FLAT" | "PERCENTAGE">("FLAT");
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const {
    subtotal,
    total_discount,
    total_tax,
    total_amount,
    tax_breakdown,
    items,
    discount_amount,
    discount_type,
  } = tab;

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(n);

  const handleApplyCartDiscount = () => {
    const amount = parseFloat(discountInputValue) || 0;
    if (amount > 0) {
      store.applyCartDiscount(amount, discountInputType);
    }
    setShowDiscountInput(false);
    setDiscountInputValue("");
  };

  const handleRemoveDiscount = () => {
    store.applyCartDiscount(0, "FLAT");
    setShowDiscountInput(false);
  };

  const handleCheckout = async () => {
    if (items.length === 0) return;
    setCheckoutLoading(true);
    try {
      const result = await store.checkout();
      if (result.success) {
        // Clear the cart after successful checkout
        store.clearCart();
        // In a real app, show success toast with invoice number
        alert(`Invoice generated! ID: ${result.invoiceId}`);
      } else {
        alert(`Checkout failed: ${result.error}`);
      }
    } catch (err) {
      console.error("Checkout error:", err);
      alert("An unexpected error occurred during checkout");
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleClearCart = () => {
    if (items.length > 0) {
      if (confirm("Clear all items from this cart?")) {
        store.clearCart();
      }
    } else {
      store.clearCart();
    }
  };

  return (
    <div className="flex flex-col h-full p-4 space-y-4">
      {/* Totals card */}
      <div className="space-y-3">
        <div className="flex items-center justify-between border-b pb-2">
          <h2 className="text-lg font-semibold">Totals</h2>
          <Badge variant="outline" className="text-xs">
            <Banknote className="h-3 w-3 mr-1" />
            {tab.items.length} items
          </Badge>
        </div>

        {/* Totals breakdown */}
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-muted-foreground">Discount</span>
            <span className="text-destructive">
              -{formatCurrency(total_discount)}
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-muted-foreground">Taxable Amount</span>
            <span>
              {formatCurrency(subtotal - total_discount)}
            </span>
          </div>

          {/* Tax breakdown */}
          <div className="border-t pt-2 space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>CGST ({tax_breakdown.cgst_rate}%)</span>
              <span>{formatCurrency(tax_breakdown.cgst_amount)}</span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>SGST ({tax_breakdown.sgst_rate}%)</span>
              <span>{formatCurrency(tax_breakdown.sgst_amount)}</span>
            </div>
            {tax_breakdown.igst_amount > 0 && (
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>IGST ({tax_breakdown.igst_rate}%)</span>
                <span>{formatCurrency(tax_breakdown.igst_amount)}</span>
              </div>
            )}
          </div>

          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Tax Total</span>
            <span>{formatCurrency(total_tax)}</span>
          </div>

          {/* Grand total */}
          <div className="border-t pt-2 flex justify-between text-xl font-bold">
            <span>GRAND TOTAL</span>
            <span className="text-primary">
              {formatCurrency(total_amount)}
            </span>
          </div>
        </div>
      </div>

      {/* Discount controls */}
      {!showDiscountInput ? (
        discount_amount > 0 ? (
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2"
            onClick={handleRemoveDiscount}
            title="Remove discount"
          >
            <Trash2 className="h-4 w-4" />
            Remove Discount (₹{formatCurrency(discount_amount)})
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2"
            onClick={() => setShowDiscountInput(true)}
          >
            Apply Discount
          </Button>
        )
      ) : (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="Amount"
              value={discountInputValue}
              onChange={(e) => setDiscountInputValue(e.target.value)}
              className="flex-1"
            />
            <Select
              options={[
                { value: "FLAT", label: "Flat" },
                { value: "PERCENTAGE", label: "%" },
              ]}
              value={discountInputType}
              onChange={(v) => setDiscountInputType(v as "FLAT" | "PERCENTAGE")}
              className="w-20"
            />
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1"
              onClick={handleApplyCartDiscount}
            >
              Apply
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowDiscountInput(false);
                setDiscountInputValue("");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Payment mode */}
      <div className="space-y-2">
        <Label>Payment Mode</Label>
        <Select
          options={PAYMENT_OPTIONS}
          value={tab.payment_mode}
          onChange={(v) =>
            store.setPaymentMode(
              v as "CASH" | "CARD" | "UPI" | "ONLINE",
            )
          }
        />
      </div>

      {/* Action buttons */}
      <div className="mt-auto space-y-2">
        <Button
          className="w-full gap-2 text-lg py-3"
          disabled={checkoutLoading || items.length === 0}
          variant={items.length > 0 ? "default" : "secondary"}
          onClick={handleCheckout}
        >
          <ShoppingCart className="h-5 w-5" />
          Checkout ({shortcutCheckout})
          {checkoutLoading && <span className="ml-2">...</span>}
        </Button>

        <Button
          variant="outline"
          className="w-full gap-2"
          disabled={items.length === 0}
          onClick={handleClearCart}
          title={`${shortcutClear}: Clear cart`}
        >
          <Trash2 className="h-4 w-4" />
          Clear Cart ({shortcutClear})
        </Button>
      </div>

      {/* Shortcut help */}
      <div className="text-xs text-muted-foreground flex items-center gap-2">
        <Keyboard className="h-3 w-3" />
        <span>
          Quick keys: F2 Customer | F4 Item | {shortcutCheckout} Checkout | {shortcutClear} Clear
        </span>
      </div>
    </div>
  );
}
