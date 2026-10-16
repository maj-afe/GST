/**
 * Tests for CartTable – the virtualized cart items table (Column 2).
 *
 * Tests:
 *   - Empty state with "Add Item" button
 *   - Item rendering with correct data
 *   - Quantity editing (Enter, Escape, Tab)
 *   - Discount editing
 *   - Item removal
 *   - Tax summary display (CGST/SGST/IGST)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CartTable } from "./CartTable";
import { useCartStore } from "@/stores/useCartStore";
import type { CartTab, CartItem, Item, Batch } from "@/types";
import { v4 as uuid } from "uuid";

function makeCartItem(overrides: Partial<CartItem> = {}): CartItem {
  const item: Item = {
    id: uuid(),
    name: "Test Medicine",
    hsn_code: "3304",
    gst_rate: 18,
    unit: "NOS",
    description: null,
    created_at: "",
    updated_at: "",
  };
  const batch: Batch = {
    id: uuid(),
    item_id: item.id,
    batch_number: "B001",
    expiry_date: new Date("2026-12-31").toISOString(),
    mrp: 100,
    rate: 100,
    stock: 50,
    min_stock: 10,
    created_at: "",
    updated_at: "",
  };

  return {
    id: uuid(),
    batch_id: batch.id,
    item,
    batch,
    quantity: 1,
    rate: 100,
    discount_amount: 0,
    tax_amount: 18,
    total_amount: 118,
    ...overrides,
  };
}

function makeTab(items: CartItem[] = []): CartTab {
  const cartItem = items[0];
  const hasItems = items.length > 0;

  return {
    id: uuid(),
    customer: null,
    items,
    discount_amount: 0,
    discount_type: "FLAT",
    payment_mode: "CASH",
    payment_status: "PENDING",
    subtotal: hasItems ? items.reduce((sum, i) => sum + i.quantity * i.rate, 0) : 0,
    total_discount: hasItems ? items.reduce((sum, i) => sum + i.discount_amount, 0) : 0,
    total_tax: hasItems ? items.reduce((sum, i) => sum + i.tax_amount, 0) : 0,
    total_amount: hasItems ? items.reduce((sum, i) => sum + i.total_amount, 0) : 0,
    tax_breakdown: {
      cgst_rate: hasItems ? cartItem.item.gst_rate / 2 : 0,
      sgst_rate: hasItems ? cartItem.item.gst_rate / 2 : 0,
      igst_rate: 0,
      cgst_amount: hasItems ? items.reduce((sum, i) => sum + i.tax_amount / 2, 0) : 0,
      sgst_amount: hasItems ? items.reduce((sum, i) => sum + i.tax_amount / 2, 0) : 0,
      igst_amount: 0,
    },
    created_at: "",
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
});

describe("CartTable – empty state", () => {
  it("should display empty state message when cart is empty", () => {
    const tab = makeTab([]);
    render(
      <CartTable
        tab={tab}
        onRemoveItem={vi.fn()}
        onUpdateQuantity={vi.fn()}
        onApplyItemDiscount={vi.fn()}
        onQuickAdd={vi.fn()}
      />,
    );

    expect(screen.getByText("No items in cart")).toBeInTheDocument();
    expect(screen.getByText("Add Item (F4)")).toBeInTheDocument();
  });

  it("should call onQuickAdd when Add Item is clicked", async () => {
    const onQuickAdd = vi.fn();
    const tab = makeTab([]);
    render(
      <CartTable
        tab={tab}
        onRemoveItem={vi.fn()}
        onUpdateQuantity={vi.fn()}
        onApplyItemDiscount={vi.fn()}
        onQuickAdd={onQuickAdd}
      />,
    );

    await userEvent.click(screen.getByText("Add Item (F4)"));
    expect(onQuickAdd).toHaveBeenCalledTimes(1);
  });
});

describe("CartTable – item rendering", () => {
  it("should display the correct number of items in the header", () => {
    const items = [makeCartItem(), makeCartItem(), makeCartItem()];
    const tab = makeTab(items);

    render(
      <CartTable
        tab={tab}
        onRemoveItem={vi.fn()}
        onUpdateQuantity={vi.fn()}
        onApplyItemDiscount={vi.fn()}
        onQuickAdd={vi.fn()}
      />,
    );

    expect(screen.getByText("Cart Items (3)")).toBeInTheDocument();
  });

  it("should display item name, batch, quantity, rate, and total", () => {
    const item = makeCartItem({ quantity: 2, rate: 150, total_amount: 342 });
    const tab = makeTab([item]);

    render(
      <CartTable
        tab={tab}
        onRemoveItem={vi.fn()}
        onUpdateQuantity={vi.fn()}
        onApplyItemDiscount={vi.fn()}
        onQuickAdd={vi.fn()}
      />,
    );

    expect(screen.getByText("Test Medicine")).toBeInTheDocument();
    expect(screen.getByText("B001")).toBeInTheDocument();
    // Quantity is shown in a clickable button
    expect(screen.getByText("2 NOS")).toBeInTheDocument();
    // Rate
    expect(screen.getAllByText(formatCurrency(150)).length).toBeGreaterThanOrEqual(1);
    // Total
    expect(screen.getAllByText(formatCurrency(342)).length).toBeGreaterThanOrEqual(1);
  });

  it("should display the item's HSN code when present", () => {
    const item = makeCartItem();
    const tab = makeTab([item]);

    render(
      <CartTable
        tab={tab}
        onRemoveItem={vi.fn()}
        onUpdateQuantity={vi.fn()}
        onApplyItemDiscount={vi.fn()}
        onQuickAdd={vi.fn()}
      />,
    );

    expect(screen.getByText("HSN: 3304")).toBeInTheDocument();
  });

  it("should display expiry date in a human-readable format", () => {
    const item = makeCartItem();
    const tab = makeTab([item]);

    render(
      <CartTable
        tab={tab}
        onRemoveItem={vi.fn()}
        onUpdateQuantity={vi.fn()}
        onApplyItemDiscount={vi.fn()}
        onQuickAdd={vi.fn()}
      />,
    );

    expect(screen.getByText(/Expiry:/)).toBeInTheDocument();
  });
});

describe("CartTable – quantity editing", () => {
  it("should enter edit mode when quantity is clicked", () => {
    const item = makeCartItem();
    const tab = makeTab([item]);

    render(
      <CartTable
        tab={tab}
        onRemoveItem={vi.fn()}
        onUpdateQuantity={vi.fn()}
        onApplyItemDiscount={vi.fn()}
        onQuickAdd={vi.fn()}
      />,
    );

    // Click on the quantity value
    const qtyButton = screen.getByText("1 NOS");
    fireEvent.click(qtyButton);

    // Input should appear
    const qtyInput = screen.getByDisplayValue("1");
    expect(qtyInput).toBeInTheDocument();
  });

  it("should call onUpdateQuantity when Enter is pressed with valid quantity", () => {
    const onUpdateQuantity = vi.fn();
    const item = makeCartItem();
    const tab = makeTab([item]);

    render(
      <CartTable
        tab={tab}
        onRemoveItem={vi.fn()}
        onUpdateQuantity={onUpdateQuantity}
        onApplyItemDiscount={vi.fn()}
        onQuickAdd={vi.fn()}
      />,
    );

    const qtyButton = screen.getByText("1 NOS");
    fireEvent.click(qtyButton);

    const qtyInput = screen.getByDisplayValue("1");
    fireEvent.change(qtyInput, { target: { value: "5" } });
    fireEvent.keyDown(qtyInput, { key: "Enter" });

    expect(onUpdateQuantity).toHaveBeenCalledWith(item.id, 5);
  });

  it("should revert on Escape in quantity edit mode", () => {
    const onUpdateQuantity = vi.fn();
    const item = makeCartItem();
    const tab = makeTab([item]);

    render(
      <CartTable
        tab={tab}
        onRemoveItem={vi.fn()}
        onUpdateQuantity={onUpdateQuantity}
        onApplyItemDiscount={vi.fn()}
        onQuickAdd={vi.fn()}
      />,
    );

    const qtyButton = screen.getByText("1 NOS");
    fireEvent.click(qtyButton);

    const qtyInput = screen.getByDisplayValue("1");
    fireEvent.change(qtyInput, { target: { value: "10" } });
    fireEvent.keyDown(qtyInput, { key: "Escape" });

    expect(onUpdateQuantity).not.toHaveBeenCalled();
    expect(screen.getByText("1 NOS")).toBeInTheDocument();
  });
});

describe("CartTable – discount editing", () => {
  it("should show '-' when no discount is set", () => {
    const item = makeCartItem({ discount_amount: 0 });
    const tab = makeTab([item]);

    render(
      <CartTable
        tab={tab}
        onRemoveItem={vi.fn()}
        onUpdateQuantity={vi.fn()}
        onApplyItemDiscount={vi.fn()}
        onQuickAdd={vi.fn()}
      />,
    );

    // The discount cell should show "-"
    const discountCell = screen.getAllByText("-");
    expect(discountCell.length).toBeGreaterThan(0);
  });

  it("should display discount amount when set", () => {
    const item = makeCartItem({ discount_amount: 20 });
    const tab = makeTab([item]);

    render(
      <CartTable
        tab={tab}
        onRemoveItem={vi.fn()}
        onUpdateQuantity={vi.fn()}
        onApplyItemDiscount={vi.fn()}
        onQuickAdd={vi.fn()}
      />,
    );

    expect(screen.getAllByText(formatCurrency(20)).length).toBeGreaterThanOrEqual(1);
  });

  it("should enter edit mode for discount when clicked", () => {
    const item = makeCartItem({ discount_amount: 0 });
    const tab = makeTab([item]);

    render(
      <CartTable
        tab={tab}
        onRemoveItem={vi.fn()}
        onUpdateQuantity={vi.fn()}
        onApplyItemDiscount={vi.fn()}
        onQuickAdd={vi.fn()}
      />,
    );

    // Click on the discount cell (the "-" button)
    const discountButtons = screen.getAllByText("-");
    fireEvent.click(discountButtons[0]);

    expect(screen.getByDisplayValue("0")).toBeInTheDocument();
  });

  it("should call onApplyItemDiscount when Enter is pressed in discount edit", () => {
    const onApplyItemDiscount = vi.fn();
    const item = makeCartItem({ discount_amount: 0 });
    const tab = makeTab([item]);

    render(
      <CartTable
        tab={tab}
        onRemoveItem={vi.fn()}
        onUpdateQuantity={vi.fn()}
        onApplyItemDiscount={onApplyItemDiscount}
        onQuickAdd={vi.fn()}
      />,
    );

    const discountButtons = screen.getAllByText("-");
    fireEvent.click(discountButtons[0]);

    const discountInput = screen.getByDisplayValue("0");
    fireEvent.change(discountInput, { target: { value: "15" } });
    fireEvent.keyDown(discountInput, { key: "Enter" });

    expect(onApplyItemDiscount).toHaveBeenCalledWith(item.id, 15);
  });
});

describe("CartTable – item removal", () => {
  it("should call onRemoveItem when trash icon is clicked", async () => {
    const onRemoveItem = vi.fn();
    const item = makeCartItem();
    const tab = makeTab([item]);

    render(
      <CartTable
        tab={tab}
        onRemoveItem={onRemoveItem}
        onUpdateQuantity={vi.fn()}
        onApplyItemDiscount={vi.fn()}
        onQuickAdd={vi.fn()}
      />,
    );

    const removeBtn = screen.getByTitle("Remove item");
    await userEvent.click(removeBtn);

    expect(onRemoveItem).toHaveBeenCalledWith(item.id);
  });
});

describe("CartTable – tax summary", () => {
  it("should display CGST and SGST in the tax summary", () => {
    const tab = makeTab([makeCartItem()]);

    render(
      <CartTable
        tab={tab}
        onRemoveItem={vi.fn()}
        onUpdateQuantity={vi.fn()}
        onApplyItemDiscount={vi.fn()}
        onQuickAdd={vi.fn()}
      />,
    );

    expect(screen.getByText(/CGST/)).toBeInTheDocument();
    expect(screen.getByText(/SGST/)).toBeInTheDocument();
  });

  it("should not display IGST when amount is 0", () => {
    const tab = makeTab([makeCartItem()]);

    render(
      <CartTable
        tab={tab}
        onRemoveItem={vi.fn()}
        onUpdateQuantity={vi.fn()}
        onApplyItemDiscount={vi.fn()}
        onQuickAdd={vi.fn()}
      />,
    );

    expect(screen.queryByText(/IGST/)).not.toBeInTheDocument();
  });
});
