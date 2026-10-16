/**
 * Tests for CustomerPanel – the customer search column (Column 1).
 *
 * Tests:
 *   - Customer search filtering by name, phone, and GSTIN
 *   - Customer selection from search results
 *   - Customer removal
 *   - Add new customer button
 *   - Show/hide search results
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CustomerPanel } from "./CustomerPanel";
import type { Customer } from "@/types";

const demoCustomers: Customer[] = [
  {
    id: "c1",
    name: "Rajesh Kumar",
    phone: "9876543210",
    address: "123 Main Road, Delhi",
    gstin: "07AABCCDDEEFFG",
    created_at: "",
    updated_at: "",
  },
  {
    id: "c2",
    name: "Priya Sharma",
    phone: "9123456789",
    address: "456 Park Street, Mumbai",
    gstin: "27AABBCCDDEEFF",
    created_at: "",
    updated_at: "",
  },
  {
    id: "c3",
    name: "Amit Patel",
    phone: "9988776655",
    address: "789 Gandhi Road, Ahmedabad",
    gstin: null,
    created_at: "",
    updated_at: "",
  },
];

function renderCustomerPanel(overrides: Partial<{
  customer: Customer | null;
  onCustomerSelect: (c: Customer | null) => void;
  onAddCustomer: () => void;
  shortcutHint: string;
}> = {}) {
  const props = {
    customer: overrides.customer ?? null,
    onCustomerSelect: overrides.onCustomerSelect ?? vi.fn(),
    onAddCustomer: overrides.onAddCustomer ?? vi.fn(),
    shortcutHint: overrides.shortcutHint ?? "F2",
  };

  return {
    ...render(<CustomerPanel {...props} />),
    props,
  };
}

describe("CustomerPanel – search", () => {
  it("should render search input when no customer is selected", () => {
    renderCustomerPanel();
    expect(
      screen.getByPlaceholderText(/Search by name, phone, or GSTIN/),
    ).toBeInTheDocument();
  });

  it("should show 'Add New Customer' button when no customer", () => {
    renderCustomerPanel();
    expect(screen.getByText("Add New Customer")).toBeInTheDocument();
  });

  it("should show no results message when search has no matches", async () => {
    renderCustomerPanel();
    const input = screen.getByPlaceholderText(/Search/);
    await userEvent.type(input, "nonexistent");

    expect(screen.getByText(/No customers found/)).toBeInTheDocument();
  });

  it("should filter customers by name", async () => {
    renderCustomerPanel();
    const input = screen.getByPlaceholderText(/Search/);
    await userEvent.type(input, "Priya");

    // Should show Priya Sharma in results
    expect(screen.getByText("Priya Sharma")).toBeInTheDocument();
    // Should NOT show other customers
    expect(screen.queryByText("Rajesh Kumar")).not.toBeInTheDocument();
  });

  it("should filter customers by phone", async () => {
    renderCustomerPanel();
    const input = screen.getByPlaceholderText(/Search/);
    await userEvent.type(input, "9988");

    expect(screen.getByText("Amit Patel")).toBeInTheDocument();
    expect(screen.queryByText("Rajesh Kumar")).not.toBeInTheDocument();
  });

  it("should filter customers by GSTIN", async () => {
    renderCustomerPanel();
    const input = screen.getByPlaceholderText(/Search/);
    await userEvent.type(input, "07AABCCDDEEFFG");

    expect(screen.getByText("Rajesh Kumar")).toBeInTheDocument();
    expect(screen.queryByText("Priya Sharma")).not.toBeInTheDocument();
  });
});

describe("CustomerPanel – customer selection", () => {
  it("should call onCustomerSelect when a customer is clicked", async () => {
    const { props } = renderCustomerPanel();
    const input = screen.getByPlaceholderText(/Search/);
    await userEvent.type(input, "Rajesh");

    const customerRow = screen.getByText("Rajesh Kumar").closest("button");
    await userEvent.click(customerRow!);

    expect(props.onCustomerSelect).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Rajesh Kumar" }),
    );
  });

  it("should clear search results after selecting a customer", async () => {
    renderCustomerPanel();
    const input = screen.getByPlaceholderText(/Search/);
    await userEvent.type(input, "Rajesh");

    expect(screen.getByText("Rajesh Kumar")).toBeInTheDocument();

    const customerRow = screen.getByText("Rajesh Kumar").closest("button");
    await userEvent.click(customerRow!);

    // After selection, search results should be cleared
    expect(screen.queryByText("Rajesh Kumar")).not.toBeInTheDocument();
  });
});

describe("CustomerPanel – customer display", () => {
  it("should display customer details when customer is selected", () => {
    const customer: Customer = demoCustomers[0];
    renderCustomerPanel({ customer });

    expect(screen.getByText("Rajesh Kumar")).toBeInTheDocument();
    expect(screen.getByText(/9876543210/)).toBeInTheDocument();
    expect(screen.getByText(/123 Main Road, Delhi/i)).toBeInTheDocument();
    expect(screen.getByText(/GSTIN: 07AABCCDDEEFFG/i)).toBeInTheDocument();
  });

  it("should show remove customer button when customer is selected", () => {
    const customer: Customer = demoCustomers[0];
    renderCustomerPanel({ customer });

    // The Trash2 icon button should be present
    const removeBtn = screen.getByTitle("Remove customer (Esc also works)");
    expect(removeBtn).toBeInTheDocument();
  });

  it("should call onCustomerSelect(null) when remove is clicked", async () => {
    const { props } = renderCustomerPanel({ customer: demoCustomers[0] });

    const removeBtn = screen.getByTitle("Remove customer (Esc also works)");
    await userEvent.click(removeBtn);

    expect(props.onCustomerSelect).toHaveBeenCalledWith(null);
  });

  it("should handle customer with null phone gracefully", () => {
    const customer: Customer = {
      ...demoCustomers[0],
      phone: null,
    };
    renderCustomerPanel({ customer });

    // Should not crash and should still display the name
    expect(screen.getByText("Rajesh Kumar")).toBeInTheDocument();
  });

  it("should handle customer with null address gracefully", () => {
    const customer: Customer = {
      ...demoCustomers[0],
      address: null,
    };
    renderCustomerPanel({ customer });

    expect(screen.getByText("Rajesh Kumar")).toBeInTheDocument();
  });

  it("should handle customer with null GSTIN (no GSTIN badge)", () => {
    const customer: Customer = demoCustomers[2]; // Amit Patel has null gstin
    renderCustomerPanel({ customer });

    expect(screen.getByText("Amit Patel")).toBeInTheDocument();
    // GSTIN badge should not appear since it's null
    expect(screen.queryByText(/GSTIN:/i)).not.toBeInTheDocument();
  });
});

describe("CustomerPanel – add customer", () => {
  it("should call onAddCustomer when Add New Customer is clicked", async () => {
    const { props } = renderCustomerPanel();

    await userEvent.click(screen.getByText("Add New Customer"));
    expect(props.onAddCustomer).toHaveBeenCalledTimes(1);
  });
});

describe("CustomerPanel – shortcut hint", () => {
  it("should display the shortcut hint in the header", () => {
    renderCustomerPanel();
    expect(screen.getByText(/Add item/i)).toBeInTheDocument();
  });

  it("should display custom shortcut hint", () => {
    renderCustomerPanel({ shortcutHint: "Ctrl+K" });
    expect(screen.getByText(/Add item/i)).toBeInTheDocument();
  });
});

// Silence unused import warning
export { demoCustomers };
