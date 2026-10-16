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

describe("debug ItemSearchDialog", () => {
  it("debug Add button click - check disabled", async () => {
    console.log("DEMO_ITEMS:", DEMO_ITEMS.map(i => ({
      name: i.name,
      stock: i.stock,
      expiry: i.expiry_date,
      isExpired: new Date(i.expiry_date) < new Date(),
    })));

    const store = useCartStore.getState();
    render(
      <ItemSearchDialog open={true} onClose={vi.fn()} store={store} />,
    );

    const addButtons = screen.getAllByText("Add 1");
    console.log("Found Add buttons:", addButtons.length);
    console.log("addButtons[0] tag:", addButtons[0].tagName);
    console.log("addButtons[0] disabled:", (addButtons[0] as HTMLButtonElement).disabled);
    console.log("addButtons[0] outerHTML:", addButtons[0].outerHTML.substring(0, 200));

    // Try fireEvent.click instead
    fireEvent.click(addButtons[0]);
    console.log("AFTER fireEvent.click - store.activeTab?.items length:", store.activeTab?.items.length);

    // Reset and try userEvent
    useCartStore.getState().reset();
    const store2 = useCartStore.getState();
    const { unmount } = render(<ItemSearchDialog open={true} onClose={vi.fn()} store={store2} />);
    const addButtons2 = screen.getAllByText("Add 1");
    await userEvent.click(addButtons2[0]);
    console.log("AFTER userEvent.click - store2.activeTab?.items length:", store2.activeTab?.items.length);
    unmount();
  });
});
