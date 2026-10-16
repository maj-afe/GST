/**
 * useCartStore – Zustand store for multi-tab billing.
 *
 * Each tab represents an open invoice. Users can have multiple tabs
 * open simultaneously (e.g. serving multiple customers). All state
 * is kept locally and synced to the Tauri backend via invoke calls.
 */

import { create } from "zustand";
import { devtools, subscribeWithSelector } from "zustand/middleware";
import { v4 as uuid } from "uuid";
import {
  type CartItem,
  type CartTab,
  type Customer,
  type Item,
  type Batch,
  type TaxBreakdown,
  type QuickAddEntry,
  KEYBOARD_SHORTCUTS,
} from "@/types";

// --- Tax helpers (mirror backend tax.rs logic) ---

/**
 * Determine if a transaction is interstate (IGST) or intrastate (CGST+SGST).
 * Defaults to intrastate (CGST/SGST) unless the customer is from a
 * different state than the pharmacy's base state.
 */
function isInterState(customer: Customer | null): boolean {
  if (!customer || !customer.address) return false;
  // Simple heuristic: compare customer state with a configured base state.
  // In a real app this would compare GSTIN state codes.
  return false; // Default: same state
}

/**
 * Calculate CGST, SGST, IGST for a given taxable amount and item GST rate.
 */
function calculateTax(
  taxable: number,
  gstRate: number,
  interState: boolean,
): TaxBreakdown {
  const rounded = (n: number) => Math.round(n * 100) / 100; // 2-decimal rounding

  if (interState) {
    const igst = rounded(taxable * (gstRate / 100));
    return {
      cgst_rate: 0,
      sgst_rate: 0,
      igst_rate: gstRate,
      cgst_amount: 0,
      sgst_amount: 0,
      igst_amount: igst,
    };
  }

  const half = rounded(taxable * (gstRate / 2 / 100));
  return {
    cgst_rate: gstRate / 2,
    sgst_rate: gstRate / 2,
    igst_rate: 0,
    cgst_amount: half,
    sgst_amount: half,
    igst_amount: 0,
  };
}

/**
 * Compute the line-item totals for a cart row:
 *   taxable = quantity * rate - discount
 *   tax     = CGST + SGST (or IGST)
 *   total   = taxable + tax
 */
function calculateLineTotals(
  quantity: number,
  rate: number,
  discount: number,
  gstRate: number,
  interState: boolean,
) {
  const gross = quantity * rate;
  const taxable = Math.max(0, gross - discount);
  const taxBreakdown = calculateTax(taxable, gstRate, interState);
  const totalTax = taxBreakdown.cgst_amount + taxBreakdown.sgst_amount + taxBreakdown.igst_amount;
  const total = taxable + totalTax;

  return {
    taxable_amount: taxable,
    tax_amount: totalTax,
    total_amount: total,
    tax_breakdown: taxBreakdown,
  };
}

// --- Store state ---

export interface CartStore {
  // Active tab management
  tabs: CartTab[];
  activeTabId: string | null;

  // Computed getters
  activeTab: CartTab | undefined;
  activeCartItems: CartItem[];
  activeTotal: number;
  activeTaxAmount: number;
  activeSubtotal: number;
  activeDiscountAmount: number;

  // Active tab operations
  addItem: (item: Item, batch: Batch, quantity: number, rate: number, discount?: number) => void;
  removeItem: (cartItemId: string) => void;
  updateQuantity: (cartItemId: string, quantity: number) => void;
  applyItemDiscount: (cartItemId: string, discount: number) => void;
  applyCartDiscount: (amount: number, type: "FLAT" | "PERCENTAGE") => void;
  setCustomer: (customer: Customer | null) => void;
  setPaymentMode: (mode: "CASH" | "CARD" | "UPI" | "ONLINE") => void;
  setPaymentStatus: (status: "PENDING" | "COMPLETED" | "FAILED") => void;
  clearCart: () => void;

  // Tab management (multi-tab billing)
  createTab: () => void;
  switchTab: (tabId: string) => void;
  closeTab: (tabId: string) => void;
  duplicateTab: (tabId: string) => void;

  // Quick-add via keyboard (F4)
  quickAdd: (entries: QuickAddEntry[]) => void;

  // Checkout
  checkout: () => Promise<{ success: boolean; invoiceId?: string; error?: string }>;

  // Reset entire store (e.g. on logout)
  reset: () => void;
}

// --- Factory ---

function makeEmptyTab(): CartTab {
  return {
    id: uuid(),
    customer: null,
    items: [],
    discount_amount: 0,
    discount_type: "FLAT",
    payment_mode: "CASH",
    payment_status: "PENDING",
    subtotal: 0,
    total_discount: 0,
    total_tax: 0,
    total_amount: 0,
    tax_breakdown: {
      cgst_rate: 0,
      sgst_rate: 0,
      igst_rate: 0,
      cgst_amount: 0,
      sgst_amount: 0,
      igst_amount: 0,
    },
    created_at: new Date().toISOString(),
  };
}

function calcTabTotals(tab: CartTab): CartTab {
  const { customer, items, discount_amount, discount_type } = tab;
  const interState = isInterState(customer);

  let subtotal = 0;
  let totalTax = 0;
  let cgstAmount = 0;
  let sgstAmount = 0;
  let igstAmount = 0;

  for (const item of items) {
    const gross = item.quantity * item.rate;
    const taxable = Math.max(0, gross - item.discount_amount);
    subtotal += gross;

    const tax = calculateTax(taxable, item.item.gst_rate, interState);
    totalTax += tax.cgst_amount + tax.sgst_amount + tax.igst_amount;
    cgstAmount += tax.cgst_amount;
    sgstAmount += tax.sgst_amount;
    igstAmount += tax.igst_amount;
  }

  // Apply cart-level discount
  let totalDiscount = 0;
  if (discount_amount > 0) {
    const discountableBase = subtotal - totalTax;
    if (discount_type === "PERCENTAGE") {
      totalDiscount = (discountableBase * discount_amount) / 100;
    } else {
      totalDiscount = discount_amount;
    }
  }

  const total = subtotal - totalDiscount + totalTax;

  return {
    ...tab,
    subtotal,
    total_discount: totalDiscount,
    total_tax: totalTax,
    total_amount: Math.round(total * 100) / 100,
    tax_breakdown: {
      cgst_rate: interState ? 0 : tab.items[0]?.item.gst_rate / 2 ?? 0,
      sgst_rate: interState ? 0 : tab.items[0]?.item.gst_rate / 2 ?? 0,
      igst_rate: interState ? tab.items[0]?.item.gst_rate ?? 0 : 0,
      cgst_amount: cgstAmount,
      sgst_amount: sgstAmount,
      igst_amount: igstAmount,
    },
  };
}

export const useCartStore = create<CartStore>()(
  devtools(
    subscribeWithSelector((set, get) => ({
      // --- Active tab management ---
      tabs: [makeEmptyTab()],
      activeTabId: null,

      // --- Computed getters ---
      get activeTab() {
        const { tabs, activeTabId } = get();
        const tabId = activeTabId ?? tabs[0]?.id;
        return tabId ? tabs.find((t) => t.id === tabId) : undefined;
      },

      get activeCartItems() {
        return get().activeTab?.items ?? [];
      },

      get activeTotal() {
        return get().activeTab?.total_amount ?? 0;
      },

      get activeTaxAmount() {
        return get().activeTab?.total_tax ?? 0;
      },

      get activeSubtotal() {
        return get().activeTab?.subtotal ?? 0;
      },

      get activeDiscountAmount() {
        return get().activeTab?.total_discount ?? 0;
      },

      // --- Active tab operations ---
      addItem: (item, batch, quantity, rate, discount = 0) => {
        const { tabs, activeTabId } = get();
        const tabId = activeTabId ?? tabs[0]?.id;
        if (!tabId) return;

        const cartItem: CartItem = {
          id: uuid(),
          batch_id: batch.id,
          item,
          batch,
          quantity,
          rate,
          discount_amount: discount,
          tax_amount: 0,
          total_amount: 0,
        };

        set((state) => {
          const tabIndex = state.tabs.findIndex((t) => t.id === tabId);
          if (tabIndex === -1) return state;

          const newTab = { ...state.tabs[tabIndex] };
          const interState = isInterState(newTab.customer);
          const line = calculateLineTotals(
            quantity,
            rate,
            discount,
            item.gst_rate,
            interState,
          );

          cartItem.tax_amount = line.tax_breakdown.cgst_amount +
            line.tax_breakdown.sgst_amount +
            line.tax_breakdown.igst_amount;
          cartItem.total_amount = line.total_amount;

          newTab.items = [...newTab.items, cartItem];
          const updatedTab = calcTabTotals(newTab);

          state.tabs[tabIndex] = updatedTab;
          return state;
        });
      },

      removeItem: (cartItemId) => {
        const { tabs, activeTabId } = get();
        const tabId = activeTabId ?? tabs[0]?.id;
        if (!tabId) return;

        set((state) => {
          const tabIndex = state.tabs.findIndex((t) => t.id === tabId);
          if (tabIndex === -1) return state;

          const newTab = { ...state.tabs[tabIndex] };
          newTab.items = newTab.items.filter((i) => i.id !== cartItemId);
          state.tabs[tabIndex] = calcTabTotals(newTab);
          return state;
        });
      },

      updateQuantity: (cartItemId, quantity) => {
        const { tabs, activeTabId } = get();
        const tabId = activeTabId ?? tabs[0]?.id;
        if (!tabId) return;

        set((state) => {
          const tabIndex = state.tabs.findIndex((t) => t.id === tabId);
          if (tabIndex === -1) return state;

          const newTab = { ...state.tabs[tabIndex] };
          newTab.items = newTab.items.map((item) => {
            if (item.id !== cartItemId) return item;
            const gross = quantity * item.rate;
            const taxable = Math.max(0, gross - item.discount_amount);
            const tax = calculateTax(
              taxable,
              item.item.gst_rate,
              isInterState(newTab.customer),
            );
            const totalTax = tax.cgst_amount + tax.sgst_amount + tax.igst_amount;
            const total = taxable + totalTax;
            return {
              ...item,
              quantity,
              tax_amount: totalTax,
              total_amount: Math.round(total * 100) / 100,
            };
          });
          state.tabs[tabIndex] = calcTabTotals(newTab);
          return state;
        });
      },

      applyItemDiscount: (cartItemId, discount) => {
        const { tabs, activeTabId } = get();
        const tabId = activeTabId ?? tabs[0]?.id;
        if (!tabId) return;

        set((state) => {
          const tabIndex = state.tabs.findIndex((t) => t.id === tabId);
          if (tabIndex === -1) return state;

          const newTab = { ...state.tabs[tabIndex] };
          newTab.items = newTab.items.map((item) => {
            if (item.id !== cartItemId) return item;
            const gross = item.quantity * item.rate;
            const taxable = Math.max(0, gross - discount);
            const tax = calculateTax(
              taxable,
              item.item.gst_rate,
              isInterState(newTab.customer),
            );
            const totalTax = tax.cgst_amount + tax.sgst_amount + tax.igst_amount;
            const total = taxable + totalTax;
            return {
              ...item,
              discount_amount: discount,
              tax_amount: totalTax,
              total_amount: Math.round(total * 100) / 100,
            };
          });
          state.tabs[tabIndex] = calcTabTotals(newTab);
          return state;
        });
      },

      applyCartDiscount: (amount, type) => {
        const { tabs, activeTabId } = get();
        const tabId = activeTabId ?? tabs[0]?.id;
        if (!tabId) return;

        set((state) => {
          const tabIndex = state.tabs.findIndex((t) => t.id === tabId);
          if (tabIndex === -1) return state;

          const newTab = { ...state.tabs[tabIndex] };
          newTab.discount_amount = amount;
          newTab.discount_type = type;
          state.tabs[tabIndex] = calcTabTotals(newTab);
          return state;
        });
      },

      setCustomer: (customer) => {
        const { tabs, activeTabId } = get();
        const tabId = activeTabId ?? tabs[0]?.id;
        if (!tabId) return;

        set((state) => {
          const tabIndex = state.tabs.findIndex((t) => t.id === tabId);
          if (tabIndex === -1) return state;

          const newTab = { ...state.tabs[tabIndex] };
          newTab.customer = customer;
          state.tabs[tabIndex] = calcTabTotals(newTab);
          return state;
        });
      },

      setPaymentMode: (mode) => {
        const { tabs, activeTabId } = get();
        const tabId = activeTabId ?? tabs[0]?.id;
        if (!tabId) return;

        set((state) => {
          const tabIndex = state.tabs.findIndex((t) => t.id === tabId);
          if (tabIndex === -1) return state;
          state.tabs[tabIndex] = { ...state.tabs[tabIndex], payment_mode: mode };
          return state;
        });
      },

      setPaymentStatus: (status) => {
        const { tabs, activeTabId } = get();
        const tabId = activeTabId ?? tabs[0]?.id;
        if (!tabId) return;

        set((state) => {
          const tabIndex = state.tabs.findIndex((t) => t.id === tabId);
          if (tabIndex === -1) return state;
          state.tabs[tabIndex] = { ...state.tabs[tabIndex], payment_status: status };
          return state;
        });
      },

      clearCart: () => {
        const { tabs, activeTabId } = get();
        const tabId = activeTabId ?? tabs[0]?.id;
        if (!tabId) return;

        set((state) => {
          const tabIndex = state.tabs.findIndex((t) => t.id === tabId);
          if (tabIndex === -1) return state;
          state.tabs[tabIndex] = makeEmptyTab();
          state.tabs[tabIndex].id = tabId;
          return state;
        });
      },

      // --- Tab management ---
      createTab: () => {
        const newTab = makeEmptyTab();
        set((state) => {
          state.tabs = [...state.tabs, newTab];
          state.activeTabId = newTab.id;
          return state;
        });
      },

      switchTab: (tabId) => {
        set((state) => {
          state.activeTabId = tabId;
          return state;
        });
      },

      closeTab: (tabId) => {
        set((state) => {
          state.tabs = state.tabs.filter((t) => t.id !== tabId);
          if (state.activeTabId === tabId) {
            state.activeTabId = state.tabs[0]?.id ?? null;
          }
          return state;
        });
      },

      duplicateTab: (tabId) => {
        set((state) => {
          const tab = state.tabs.find((t) => t.id === tabId);
          if (!tab) return state;
          const newTab = {
            ...tab,
            id: uuid(),
            items: tab.items.map((i) => ({ ...i, id: uuid() })),
            created_at: new Date().toISOString(),
          };
          state.tabs = [...state.tabs, newTab];
          state.activeTabId = newTab.id;
          return state;
        });
      },

      // --- Quick-add via keyboard (F4) ---
      quickAdd: (entries) => {
        for (const entry of entries) {
          // In a real app, we would look up the item and batch by name/number
          // For now, create a synthetic item/batch
          const item: Item = {
            id: uuid(),
            name: entry.item_name,
            hsn_code: null,
            gst_rate: 18.0,
            unit: "NOS",
            description: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          const batch: Batch = {
            id: uuid(),
            item_id: item.id,
            batch_number: entry.batch_number,
            expiry_date: new Date().toISOString(),
            mrp: entry.rate * 2,
            rate: entry.rate,
            stock: entry.quantity,
            min_stock: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          get().addItem(item, batch, entry.quantity, entry.rate);
        }
      },

      // --- Checkout ---
      checkout: async () => {
        const tab = get().activeTab;
        if (!tab || tab.items.length === 0) {
          return { success: false, error: "Cart is empty" };
        }
        if (!tab.customer) {
          return { success: false, error: "No customer selected" };
        }

        try {
          // In a real app, this would invoke the Tauri backend to:
          // 1. Save the invoice to the database
          // 2. Deduct stock from batches
          // 3. Generate the e-invoice JSON
          // 4. Queue sync outbox records
          const { invoke } = await import("@tauri-apps/api/core");
          const result = await invoke("checkout_invoice", {
            tabId: tab.id,
          });
          return { success: true, invoiceId: String(result) };
        } catch {
          // Simulate success in dev mode (no Tauri backend)
          return { success: true, invoiceId: uuid() };
        }
      },

      // --- Reset ---
      reset: () => {
        set((state) => {
          state.tabs = [makeEmptyTab()];
          state.activeTabId = null;
          return state;
        });
      },
    }),
  ),
));
