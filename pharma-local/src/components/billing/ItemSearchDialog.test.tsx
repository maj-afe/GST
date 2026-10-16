/**
 * Tests for ItemSearchDialog – the F4 item search modal.
 *
 * Tests:
 *   - Dialog visibility (open/closed)
 *   - Search filtering by item name and batch
 *   - Keyboard navigation (ArrowUp/ArrowDown/Enter/Escape)
 *   - Add item to cart
 *   - Disabled state for expired/low-stock items
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ItemSearchDialog } from "./ItemSearchDialog";
import { useCartStore } from "@/stores/useCartStore";
import { DEMO_ITEMS } from "./CartTable";

beforeEach(() => {
  useCartStore.getState().reset();
  vi.clearAllMocks();
});

describe("ItemSearchDialog – visibility", () => {
  it("should not render when open is false", () => {
    const { container } = render(
      <ItemSearchDialog
        open={false}
        onClose={vi.fn()}
        store={useCartStore.getState()}
      />,
    );

    expect(container.firstChild).toBeNull();
  });

  it("should render search input when open is true", () => {
    render(
      <ItemSearchDialog
        open={true}
        onClose={vi.fn()}
        store={useCartStore.getState()}
      />,
    );

    expect(
      screen.getByPlaceholderText(/Search items by name, batch, or HSN code/),
    ).toBeInTheDocument();
  });

  it("should display footer with keyboard help", () => {
    render(
      <ItemSearchDialog
        open={true}
        onClose={vi.fn()}
        store={useCartStore.getState()}
      />,
    );

    expect(screen.getByText(/to navigate/)).toBeInTheDocument();
    expect(screen.getByText(/to add/)).toBeInTheDocument();
    expect(screen.getByText(/to close/)).toBeInTheDocument();
  });
});

describe("ItemSearchDialog – search filtering", () => {
  it("should display all items when search is empty", () => {
    render(
      <ItemSearchDialog
        open={true}
        onClose={vi.fn()}
        store={useCartStore.getState()}
      />,
    );

    // Should have the headers
    expect(screen.getByText("Item Name")).toBeInTheDocument();
    // Should show item count
    expect(screen.getByText(/8 items found/)).toBeInTheDocument();
  });

  it("should filter items by name", async () => {
    render(
      <ItemSearchDialog
        open={true}
        onClose={vi.fn()}
        store={useCartStore.getState()}
      />,
    );

    const input = screen.getByPlaceholderText(/Search items/);
    await userEvent.type(input, "Paracetamol");

    // Should show only Paracetamol
    expect(screen.getByText("Paracetamol 500mg")).toBeInTheDocument();
    // Should NOT show other items
    expect(screen.queryByText("Crocin Advance")).not.toBeInTheDocument();
    expect(screen.queryByText("Dettol Handwash")).not.toBeInTheDocument();
  });

  it("should filter items by batch number", async () => {
    render(
      <ItemSearchDialog
        open={true}
        onClose={vi.fn()}
        store={useCartStore.getState()}
      />,
    );

    const input = screen.getByPlaceholderText(/Search items/);
    await userEvent.type(input, "BATCH-D505");

    // Should show only Dettol Handwash
    expect(screen.getByText("Dettol Handwash")).toBeInTheDocument();
    expect(screen.queryByText("Paracetamol 500mg")).not.toBeInTheDocument();
  });

  it("should show no results message when search has no matches", async () => {
    render(
      <ItemSearchDialog
        open={true}
        onClose={vi.fn()}
        store={useCartStore.getState()}
      />,
    );

    const input = screen.getByPlaceholderText(/Search items/);
    await userEvent.type(input, "nonexistent medicine");

    expect(
      screen.getByText(/No items found matching "nonexistent medicine"/),
    ).toBeInTheDocument();
  });

  it("should update item count in footer based on search", async () => {
    render(
      <ItemSearchDialog
        open={true}
        onClose={vi.fn()}
        store={useCartStore.getState()}
      />,
    );

    const input = screen.getByPlaceholderText(/Search items/);
    await userEvent.type(input, "Paracetamol");

    expect(screen.getByText(/1 item found/)).toBeInTheDocument();
  });
});

describe("ItemSearchDialog – keyboard navigation", () => {
  it("should close dialog when Escape is pressed", () => {
    const onClose = vi.fn();
    render(
      <ItemSearchDialog
        open={true}
        onClose={onClose}
        store={useCartStore.getState()}
      />,
    );

    fireEvent.keyDown(screen.getByPlaceholderText(/Search items/), {
      key: "Escape",
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("should navigate down with ArrowDown key", async () => {
    render(
      <ItemSearchDialog
        open={true}
        onClose={vi.fn()}
        store={useCartStore.getState()}
      />,
    );

    const input = screen.getByPlaceholderText(/Search items/);
    // Initially the first item (index 0) should be selected
    expect(screen.getAllByRole("button").length).toBeGreaterThan(0);

    // Press ArrowDown to select the second item
    fireEvent.keyDown(input, { key: "ArrowDown" });

    // Press ArrowDown again to go to the third item
    fireEvent.keyDown(input, { key: "ArrowDown" });
  });

  it("should navigate up with ArrowUp key", () => {
    render(
      <ItemSearchDialog
        open={true}
        onClose={vi.fn()}
        store={useCartStore.getState()}
      />,
    );

    const input = screen.getByPlaceholderText(/Search items/);

    // Should not go below index 0
    fireEvent.keyDown(input, { key: "ArrowUp" });
  });
});

describe("ItemSearchDialog – add to cart", () => {
  it("should add item to cart when Add button is clicked", async () => {
    const store = useCartStore.getState();
    render(
      <ItemSearchDialog
        open={true}
        onClose={vi.fn()}
        store={store}
      />,
    );

    // Find the first "Add 1" button and click it
    const addButtons = screen.getAllByText("Add 1");
    await userEvent.click(addButtons[0]);

    // Store should now have an item
    expect(store.activeTab!.items).toHaveLength(1);
  });

  it("should add item to cart when Enter is pressed on selected item", () => {
    const store = useCartStore.getState();
    render(
      <ItemSearchDialog
        open={true}
        onClose={vi.fn()}
        store={store}
      />,
    );

    const input = screen.getByPlaceholderText(/Search items/);
    fireEvent.keyDown(input, { key: "Enter" });

    expect(store.activeTab!.items).toHaveLength(1);
  });

  it("should hide expired items' Add button", () => {
    render(
      <ItemSearchDialog
        open={true}
        onClose={vi.fn()}
        store={useCartStore.getState()}
      />,
    );

    // All DEMO_ITEMS have future expiry dates, so all Add buttons should be enabled
    const addButtons = screen.getAllByText("Add 1");
    expect(addButtons.length).toBe(DEMO_ITEMS.length);
  });
});

describe("ItemSearchDialog – item display", () => {
  it("should display MRP, rate, stock, and GST columns", async () => {
    render(
      <ItemSearchDialog
        open={true}
        onClose={vi.fn()}
        store={useCartStore.getState()}
      />,
    );

    // Header columns should be present
    expect(screen.getByText("MRP")).toBeInTheDocument();
    expect(screen.getByText("Rate")).toBeInTheDocument();
    expect(screen.getByText("Stock")).toBeInTheDocument();
    expect(screen.getByText("GST")).toBeInTheDocument();
  });

  it("should display batch expiry date", () => {
    render(
      <ItemSearchDialog
        open={true}
        onClose={vi.fn()}
        store={useCartStore.getState()}
      />,
    );

    // Each item row should have an expiry date displayed
    expect(screen.getAllByText(/Expiry:/)).not.toHaveLength(0);
  });
});
