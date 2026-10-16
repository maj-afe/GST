/**
 * Shared type definitions for PharmaLocal frontend.
 * These mirror the Rust backend structs in src-tauri/src/models.rs.
 */

/** A medicine/product in inventory (mirrors Rust `Item` struct) */
export interface Item {
  id: string;
  name: string;
  hsn_code: string | null;
  gst_rate: number;
  unit: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

/** A specific batch of an item with MRP, rate, and stock (mirrors Rust `Batch`) */
export interface Batch {
  id: string;
  item_id: string;
  batch_number: string;
  expiry_date: string; // ISO date string
  mrp: number;
  rate: number;
  stock: number;
  min_stock: number;
  created_at: string;
  updated_at: string;
}

/** A customer record (mirrors Rust `Customer`) */
export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  gstin: string | null;
  created_at: string;
  updated_at: string;
}

/** An item added to the billing cart */
export interface CartItem {
  id: string; // unique key for the line item
  batch_id: string;
  item: Item;
  batch: Batch;
  quantity: number;
  rate: number; // selling rate (per unit)
  discount_amount: number; // total discount for this line
  tax_amount: number; // total tax for this line
  total_amount: number; // line total including tax
}

/** Tax breakdown for a cart item (CGST/SGST/IGST split) */
export interface TaxBreakdown {
  cgst_rate: number;
  sgst_rate: number;
  igst_rate: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
}

/** A single open billing tab */
export interface CartTab {
  id: string;
  customer: Customer | null;
  items: CartItem[];
  discount_amount: number; // flat discount on the whole cart
  discount_type: "FLAT" | "PERCENTAGE";
  payment_mode: "CASH" | "CARD" | "UPI" | "ONLINE";
  payment_status: "PENDING" | "COMPLETED" | "FAILED";
  // Cached totals (recalculated when items change)
  subtotal: number;
  total_discount: number;
  total_tax: number;
  total_amount: number;
  tax_breakdown: TaxBreakdown;
  created_at: string;
}

/** A cart line for adding items via F4 quick-add */
export interface QuickAddEntry {
  item_name: string;
  batch_number: string;
  quantity: number;
  rate: number;
}

/** Keyboard shortcut definitions per Section 4.1 of the PRD */
export const KEYBOARD_SHORTCUTS = {
  F2: "add_customer",
  F4: "add_item",
  F9: "checkout",
  Escape: "clear_cart",
} as const;

/** Payment mode options */
export const PAYMENT_MODES = ["CASH", "CARD", "UPI", "ONLINE"] as const;
