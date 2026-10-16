/**
 * Tests for TotalsPanel – the tax breakdown and checkout button column.
 *
 * Tests:
 *   - Tax breakdown display (CGST/SGST/IGST)
 *   - Grand total calculation display
 *   - Checkout button state (disabled when empty)
 *   - Clear cart button
 *   - Discount application
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TotalsPanel } from "./TotalsPanel";
import { useCartStore } from "@/stores/useCartStore";
import type { CartTab, Item, Batch } from "@/types";
import { v4 as uuid } from "uuid";

function makeTab(overrides: Partial<CartTab> = {}): CartTab {
  const item: Item = {
    id: uuid(),
    name: "Test Medicine",
    hsn_code: "3304",
    gst_rate: 18,
    unit: "NOS",
    description: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const batch: Batch = {
    id: uuid(),
    item_id: item.id,
    batch_number: "B001",
    expiry_date: new Date("2026-12-31").toISOString(),
    mrp: 100,
    rate: 80,
    stock: 100,
    min_stock: 10,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

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
    ...overrides,
  };
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(n);
}

beforeEach(() => {
  useCartStore.getState().reset();
  vi.clearAllMocks();
});

describe("TotalsPanel – tax breakdown display", () => {
  it("should display CGST and SGST amounts correctly", () => {
    const tab = makeTab({
      items: [
        {
          id: "cart-1",
          batch_id: "batch-1",
          item: { id: "item-1", name: "Med", hsn_code: null, gst_rate: 18, unit: "NOS", description: null, created_at: "", updated_at: "" },
          batch: { id: "b1", item_id: "item-1", batch_number: "B1", expiry_date: "2026-12-31", mrp: 100, rate: 100, stock: 10, min_stock: 5, created_at: "", updated_at: "" },
          quantity: 1,
          rate: 100,
          discount_amount: 0,
          tax_amount: 18,
          total_amount: 118,
        },
      ],
      subtotal: 100,
      total_tax: 18,
      total_amount: 118,
      tax_breakdown: {
        cgst_rate: 9,
        sgst_rate: 9,
        igst_rate: 0,
        cgst_amount: 9,
        sgst_amount: 9,
        igst_amount: 0,
      },
    });

    render(<TotalsPanel tab={tab} store={useCartStore.getState()} />);

    // CGST should be displayed
    expect(screen.getByText(/CGST/)).toBeInTheDocument();
    expect(screen.getByText(formatCurrency(9))).toBeInTheDocument();

    // SGST should be displayed
    expect(screen.getByText(/SGST/)).toBeInTheDocument();
    expect(screen.getByText(formatCurrency(9))).toBeInTheDocument();

    // IGST should NOT be displayed (amount is 0)
    expect(screen.queryByText(/IGST/)).not.toBeInTheDocument();
  });

  it("should display IGST when interstate transaction", () => {
    const tab = makeTab({
      tax_breakdown: {
        cgst_rate: 0,
        sgst_rate: 0,
        igst_rate: 18,
        cgst_amount: 0,
        sgst_amount: 0,
        igst_amount: 18,
      },
      total_tax: 18,
    });

    render(<TotalsPanel tab={tab} store={useCartStore.getState()} />);

    // IGST should be displayed
    expect(screen.getByText(/IGST/)).toBeInTheDocument();
    expect(screen.getAllByText(formatCurrency(18)).length).toBeGreaterThanOrEqual(1);
  });

  it("should display grand total correctly", () => {
    const tab = makeTab({
      subtotal: 500,
      total_tax: 90,
      total_amount: 590,
    });

    render(<TotalsPanel tab={tab} store={useCartStore.getState()} />);

    expect(screen.getByText("GRAND TOTAL")).toBeInTheDocument();
    expect(screen.getByText(formatCurrency(590))).toBeInTheDocument();
  });

  it("should display item count badge", () => {
    const tab = makeTab({
      items: [
        {
          id: "cart-1",
          batch_id: "b1",
          item: { id: "i1", name: "M", hsn_code: null, gst_rate: 18, unit: "NOS", description: null, created_at: "", updated_at: "" },
          batch: { id: "b1", item_id: "i1", batch_number: "B1", expiry_date: "2026-12-31", mrp: 100, rate: 100, stock: 10, min_stock: 5, created_at: "", updated_at: "" },
          quantity: 2,
          rate: 100,
          discount_amount: 0,
          tax_amount: 36,
          total_amount: 236,
        },
        {
          id: "cart-2",
          batch_id: "b2",
          item: { id: "i2", name: "M2", hsn_code: null, gst_rate: 5, unit: "NOS", description: null, created_at: "", updated_at: "" },
          batch: { id: "b2", item_id: "i2", batch_number: "B2", expiry_date: "2026-12-31", mrp: 50, rate: 50, stock: 10, min_stock: 5, created_at: "", updated_at: "" },
          quantity: 1,
          rate: 50,
          discount_amount: 0,
          tax_amount: 2.5,
          total_amount: 52.5,
        },
      ],
    });

    render(<TotalsPanel tab={tab} store={useCartStore.getState()} />);

    // Should show "2 items"
    expect(screen.getByText(/2 items/)).toBeInTheDocument();
  });
});

describe("TotalsPanel – checkout button", () => {
  it("should disable checkout when cart is empty", () => {
    const tab = makeTab({ items: [] });
    render(<TotalsPanel tab={tab} store={useCartStore.getState()} />);

    const checkoutBtn = screen.getByText(/Checkout/);
    expect(checkoutBtn.closest("button")).toBeDisabled();
  });

  it("should enable checkout when cart has items", () => {
    const tab = makeTab({
      items: [
        {
          id: "cart-1",
          batch_id: "b1",
          item: { id: "i1", name: "M", hsn_code: null, gst_rate: 18, unit: "NOS", description: null, created_at: "", updated_at: "" },
          batch: { id: "b1", item_id: "i1", batch_number: "B1", expiry_date: "2026-12-31", mrp: 100, rate: 100, stock: 10, min_stock: 5, created_at: "", updated_at: "" },
          quantity: 1,
          rate: 100,
          discount_amount: 0,
          tax_amount: 18,
          total_amount: 118,
        },
      ],
    });

    render(<TotalsPanel tab={tab} store={useCartStore.getState()} />);

    const checkoutBtn = screen.getByText(/Checkout/);
    expect(checkoutBtn.closest("button")).not.toBeDisabled();
  });

  it("should call store.checkout and store.clearCart on successful checkout", async () => {
    const store = useCartStore.getState();
    const tab = makeTab({
      customer: { id: "c1", name: "Test", phone: "123", address: "addr", gstin: null, created_at: "", updated_at: "" },
      items: [
        {
          id: "cart-1",
          batch_id: "b1",
          item: { id: "i1", name: "M", hsn_code: null, gst_rate: 18, unit: "NOS", description: null, created_at: "", updated_at: "" },
          batch: { id: "b1", item_id: "i1", batch_number: "B1", expiry_date: "2026-12-31", mrp: 100, rate: 100, stock: 10, min_stock: 5, created_at: "", updated_at: "" },
          quantity: 1,
          rate: 100,
          discount_amount: 0,
          tax_amount: 18,
          total_amount: 118,
        },
      ],
    });

    const checkoutSpy = vi.spyOn(store, "checkout").mockResolvedValue({
      success: true,
      invoiceId: "inv-123",
    });
    const clearSpy = vi.spyOn(store, "clearCart");

    render(<TotalsPanel tab={tab} store={store} />);

    const checkoutBtn = screen.getByRole("button", { name: /Checkout/ });
    await userEvent.click(checkoutBtn);

    await waitFor(() => {
      expect(checkoutSpy).toHaveBeenCalled();
    });
    expect(clearSpy).toHaveBeenCalled();
  });
});

describe("TotalsPanel – clear cart button", () => {
  it("should disable clear cart when items are empty", () => {
    const tab = makeTab({ items: [] });
    render(<TotalsPanel tab={tab} store={useCartStore.getState()} />);

    const clearBtn = screen.getByText(/Clear Cart/);
    expect(clearBtn.closest("button")).toBeDisabled();
  });

  it("should enable clear cart when items exist", () => {
    const tab = makeTab({
      items: [
        {
          id: "cart-1",
          batch_id: "b1",
          item: { id: "i1", name: "M", hsn_code: null, gst_rate: 18, unit: "NOS", description: null, created_at: "", updated_at: "" },
          batch: { id: "b1", item_id: "i1", batch_number: "B1", expiry_date: "2026-12-31", mrp: 100, rate: 100, stock: 10, min_stock: 5, created_at: "", updated_at: "" },
          quantity: 1,
          rate: 100,
          discount_amount: 0,
          tax_amount: 18,
          total_amount: 118,
        },
      ],
    });

    render(<TotalsPanel tab={tab} store={useCartStore.getState()} />);

    const clearBtn = screen.getByText(/Clear Cart/);
    expect(clearBtn.closest("button")).not.toBeDisabled();
  });

  it("should show confirm dialog before clearing", () => {
    const store = useCartStore.getState();
    const clearSpy = vi.spyOn(store, "clearCart");

    const tab = makeTab({
      items: [
        {
          id: "cart-1",
          batch_id: "b1",
          item: { id: "i1", name: "M", hsn_code: null, gst_rate: 18, unit: "NOS", description: null, created_at: "", updated_at: "" },
          batch: { id: "b1", item_id: "i1", batch_number: "B1", expiry_date: "2026-12-31", mrp: 100, rate: 100, stock: 10, min_stock: 5, created_at: "", updated_at: "" },
          quantity: 1,
          rate: 100,
          discount_amount: 0,
          tax_amount: 18,
          total_amount: 118,
        },
      ],
    });

    // confirm is mocked to return true in setup
    render(<TotalsPanel tab={tab} store={store} />);

    const clearBtn = screen.getByText(/Clear Cart/);
    fireEvent.click(clearBtn);

    expect(clearSpy).toHaveBeenCalled();
  });
});

describe("TotalsPanel – discount controls", () => {
  it("should show 'Apply Discount' button when no discount is set", () => {
    const tab = makeTab({ discount_amount: 0 });
    render(<TotalsPanel tab={tab} store={useCartStore.getState()} />);

    expect(screen.getByText("Apply Discount")).toBeInTheDocument();
  });

  it("should show 'Remove Discount' button when discount is set", () => {
    const tab = makeTab({ discount_amount: 20 });
    render(<TotalsPanel tab={tab} store={useCartStore.getState()} />);

    expect(screen.getByText(/Remove Discount/)).toBeInTheDocument();
  });

  it("should open discount input when Apply Discount is clicked", () => {
    const tab = makeTab({ discount_amount: 0 });
    render(<TotalsPanel tab={tab} store={useCartStore.getState()} />);

    fireEvent.click(screen.getByText("Apply Discount"));

    expect(screen.getByPlaceholderText("Amount")).toBeInTheDocument();
    expect(screen.getByText("Apply")).toBeInTheDocument();
  });
});
