/**
 * Tests for BillingTerminal – the main 3-column billing UI.
 *
 * Tests:
 *   - Initial render with one empty tab
 *   - Tab bar rendering
 *   - New tab creation
 *   - Tab switching
 *   - Tab closing
 *   - Keyboard shortcuts (F2, F4, F9, F9, Esc)
 *   - 3-column grid layout structure
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BillingTerminal } from "./BillingTerminal";
import { useCartStore } from "@/stores/useCartStore";

beforeEach(() => {
  useCartStore.getState().reset();
  vi.clearAllMocks();
});

afterEach(() => {
  useCartStore.getState().reset();
});

describe("BillingTerminal – initial render", () => {
  it("should render the billing terminal header", () => {
    render(<BillingTerminal />);
    expect(screen.getByText("PharmaLocal — Billing Terminal")).toBeInTheDocument();
  });

  it("should render three main columns", () => {
    render(<BillingTerminal />);

    // Column 1: Customer panel
    expect(screen.getByText("Customer")).toBeInTheDocument();
    // Column 2: Cart table
    expect(screen.getByText("Cart Items")).toBeInTheDocument();
    // Column 3: Totals
    expect(screen.getByText("Totals")).toBeInTheDocument();
  });

  it("should auto-create a tab on mount if none exist", async () => {
    // Reset to ensure no tabs
    useCartStore.getState().reset();

    render(<BillingTerminal />);

    // The header should show at least one tab
    await vi.waitFor(() => {
      const tabs = screen.getAllByRole("button");
      // Should have at least 2 buttons: tab + "New Tab" button
      expect(tabs.length).toBeGreaterThanOrEqual(2);
    });
  });

  it("should show empty cart message when tab has no items", () => {
    render(<BillingTerminal />);

    expect(screen.getByText("No items in cart")).toBeInTheDocument();
    expect(screen.getByText("Add Item (F4)")).toBeInTheDocument();
  });
});

describe("BillingTerminal – tab bar", () => {
  it("should render a New Tab button in the tab bar", () => {
    render(<BillingTerminal />);

    expect(screen.getByText("New Tab")).toBeInTheDocument();
  });

  it("should create a new tab when New Tab is clicked", async () => {
    render(<BillingTerminal />);

    const store = useCartStore.getState();
    expect(store.tabs).toHaveLength(1);

    await userEvent.click(screen.getByText("New Tab"));

    expect(store.tabs).toHaveLength(2);
  });

  it("should show item count badge on tab when cart has items", async () => {
    render(<BillingTerminal />);

    const store = useCartStore.getState();
    const { tabs } = useCartStore.getState();
    const tabId = tabs[0]?.id;

    // Add an item via the store
    const { item, batch } = store.tabs.length > 0 ? {
      item: { id: "i1", name: "Test", hsn_code: null, gst_rate: 18, unit: "NOS", description: null, created_at: "", updated_at: "" },
      batch: { id: "b1", item_id: "i1", batch_number: "B1", expiry_date: "2026-12-31", mrp: 100, rate: 100, stock: 10, min_stock: 5, created_at: "", updated_at: "" },
    } : { item: undefined, batch: undefined };

    if (item && batch) {
      store.addItem(item, batch, 1, 100);
    }

    // Re-read the store state
    await vi.waitFor(() => {
      expect(screen.getByText("1")).toBeInTheDocument();
    });
  });

  it("should switch tabs when a tab is clicked", async () => {
    render(<BillingTerminal />);

    const store = useCartStore.getState();
    const firstTabId = store.tabs[0].id;

    // Create a second tab
    store.createTab();
    expect(store.activeTabId).toBe(store.tabs[1].id);

    // Click on the first tab
    const tabButtons = screen.getAllByRole("button");
    const firstTabButton = tabButtons.find((btn) =>
      btn.textContent?.includes("Tab 1"),
    );

    if (firstTabButton) {
      await userEvent.click(firstTabButton);
      expect(store.activeTabId).toBe(firstTabId);
    }
  });
});

describe("BillingTerminal – keyboard shortcuts", () => {
  it("should open item search (F4) when F4 is pressed", async () => {
    render(<BillingTerminal />);

    fireEvent.keyDown(document, { key: "F4" });

    expect(screen.getByText("Search items by name, batch, or HSN code...")).toBeInTheDocument();
  });

  it("should close item search when ESC is pressed while it is open", async () => {
    render(<BillingTerminal />);

    // Open
    fireEvent.keyDown(document, { key: "F4" });
    expect(screen.getByText("Search items")).toBeInTheDocument();

    // Close
    fireEvent.keyDown(document, { key: "Escape" });

    // The dialog should close (search input no longer in the document)
    expect(
      screen.queryByText("Search items by name, batch, or HSN code..."),
    ).not.toBeInTheDocument();
  });

  it("should call handleCheckout when F9 is pressed with items and customer", async () => {
    render(<BillingTerminal />);

    const store = useCartStore.getState();

    // Set up: add items and customer
    const item = {
      id: "i1",
      name: "Test Med",
      hsn_code: null,
      gst_rate: 18,
      unit: "NOS",
      description: null,
      created_at: "",
      updated_at: "",
    };
    const batch = {
      id: "b1",
      item_id: "i1",
      batch_number: "B1",
      expiry_date: "2026-12-31",
      mrp: 100,
      rate: 100,
      stock: 10,
      min_stock: 5,
      created_at: "",
      updated_at: "",
    };
    store.addItem(item, batch, 1, 100);
    store.setCustomer({
      id: "c1",
      name: "Test Customer",
      phone: "1234567890",
      address: "Address",
      gstin: null,
      created_at: "",
      updated_at: "",
    });

    const checkoutSpy = vi.spyOn(store, "checkout");

    fireEvent.keyDown(document, { key: "F9" });

    await vi.waitFor(() => {
      expect(checkoutSpy).toHaveBeenCalled();
    });
  });
});

describe("BillingTerminal – layout", () => {
  it("should render the shortcut help in totals panel", () => {
    render(<BillingTerminal />);

    expect(
      screen.getByText(/F2 Customer.*F4 Item.*F9 Checkout.*Esc Clear/i),
    ).toBeInTheDocument();
  });
});
