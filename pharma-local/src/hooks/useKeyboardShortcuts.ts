/**
 * useKeyboardShortcuts – React hook for billing terminal keyboard shortcuts.
 *
 * Implements Section 4.1 of the PRD:
 *   F2  — Add/select customer
 *   F4  — Add item to cart (open item search)
 *   F9  — Checkout
 *   Esc — Clear / cancel current operation
 */

import { useEffect, useCallback } from "react";
import type { CartStore } from "@/stores/useCartStore";

export type ShortcutAction =
  | "add_customer"
  | "add_item"
  | "checkout"
  | "clear_cart";

export interface ShortcutCallbacks {
  onAddCustomer?: () => void;
  onAddItem?: () => void;
  onCheckout?: () => void;
  onClearCart?: () => void;
}

const SHORTCUT_MAP: Record<ShortcutAction, string[]> = {
  add_customer: ["F2"],
  add_item: ["F4"],
  checkout: ["F9"],
  clear_cart: ["Escape"],
};

export function useKeyboardShortcuts(callbacks: ShortcutCallbacks) {
  const {
    onAddCustomer,
    onAddItem,
    onCheckout,
    onClearCart,
  } = callbacks;

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const action = Object.entries(SHORTCUT_MAP).find(([_, keys]) =>
        keys.some((key) => event.key === key),
      )?.[0] as ShortcutAction | undefined;

      if (!action) return;

      // Prevent default browser behavior (e.g. F5 refresh, Esc in some contexts)
      event.preventDefault();

      switch (action) {
        case "add_customer":
          onAddCustomer?.();
          break;
        case "add_item":
          onAddItem?.();
          break;
        case "checkout":
          onCheckout?.();
          break;
        case "clear_cart":
          onClearCart?.();
          break;
      }
    },
    [onAddCustomer, onAddItem, onCheckout, onClearCart],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return SHORTCUT_MAP;
}

/**
 * Convenience hook that wires the standard shortcuts to the cart store.
 * Pass `false` for `enabled` to temporarily disable shortcuts (e.g. when a
 * modal dialog is open and we want typing to go to the dialog).
 */
export function useBillingShortcuts(store: CartStore, enabled = true) {
  const callbacks = enabled
    ? {
        onAddCustomer: () => store.createTab(),
        onAddItem: () => {
          /* opens item search dialog — handled by caller via ref */
        },
        onCheckout: () => store.checkout(),
        onClearCart: () => store.clearCart(),
      }
    : {};

  // Filter out undefined callbacks
  const filtered: ShortcutCallbacks = {};
  for (const [key, value] of Object.entries(callbacks)) {
    if (value) {
      (filtered as Record<string, () => void>)[key] = value;
    }
  }

  return useKeyboardShortcuts(filtered);
}
